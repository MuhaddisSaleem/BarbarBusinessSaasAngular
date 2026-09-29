using System.Data;
using System.Globalization;
using BarberFlow.Api.Contracts.Bookings;
using BarberFlow.Api.Data;
using BarberFlow.Api.Domain.Entities;
using BarberFlow.Api.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace BarberFlow.Api.Services;

public sealed class BookingApplicationService(
    BarberFlowDbContext db,
    IConfiguration configuration)
{
    private readonly string _salonSlug =
        configuration["DevelopmentData:SalonSlug"] ?? "royal-barbers";

    public async Task<IReadOnlyList<BookingDto>> GetAllAsync(CancellationToken cancellationToken)
    {
        var salon = await GetSalonAsync(cancellationToken);

        var bookings = await db.Bookings
            .AsNoTracking()
            .Where(x => x.SalonId == salon.Id)
            .Include(x => x.Barber)
            .Include(x => x.Services)
            .OrderByDescending(x => x.AppointmentDate)
            .ThenByDescending(x => x.StartTime)
            .ToListAsync(cancellationToken);

        return bookings.Select(Map).ToList();
    }

    public async Task<BookingDto?> GetAsync(long id, CancellationToken cancellationToken)
    {
        var salon = await GetSalonAsync(cancellationToken);

        var booking = await db.Bookings
            .AsNoTracking()
            .Where(x => x.SalonId == salon.Id && x.PublicId == id)
            .Include(x => x.Barber)
            .Include(x => x.Services)
            .SingleOrDefaultAsync(cancellationToken);

        return booking is null ? null : Map(booking);
    }

    public Task<BookingMutationResponse> CreateOnlineAsync(
        CreateBookingsRequest request,
        CancellationToken cancellationToken)
    {
        return CreateAsync(request, BookingSource.Online, false, cancellationToken);
    }

    public async Task<BookingMutationResponse> CreateWalkInAsync(
        BookingInputDto input,
        CancellationToken cancellationToken)
    {
        var request = new CreateBookingsRequest([input]);
        return await CreateAsync(request, BookingSource.WalkIn, true, cancellationToken);
    }

    public async Task<BookingMutationResponse> UpdateStatusAsync(
        long id,
        string statusValue,
        CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<BookingStatus>(statusValue, true, out var status))
        {
            return Failure("Invalid booking status.");
        }

        var booking = await LoadTrackedAsync(id, cancellationToken);
        if (booking is null) return Failure("Booking not found.");

        if (booking.Status == BookingStatus.Cancelled && status != BookingStatus.Cancelled)
            return Failure("Cancelled bookings cannot be reopened.");

        if (booking.Status == BookingStatus.Completed && status != BookingStatus.Completed)
            return Failure("Completed bookings cannot be moved back to another status.");

        if (
            status is BookingStatus.Confirmed or BookingStatus.Completed
            && booking.ServiceLocation == ServiceLocation.Home
            && !string.IsNullOrWhiteSpace(booking.SpecialService)
            && !(booking.SpecialServiceAmount > 0)
        )
        {
            return Failure("Set the custom home-service price before confirming this booking.");
        }

        booking.Status = status;
        await db.SaveChangesAsync(cancellationToken);

        return Success(
            "Booking " + booking.BookingCode + " marked " + status.ToString().ToLowerInvariant() + ".",
            Map(booking));
    }

    public async Task<BookingMutationResponse> AssignBarberAsync(
        long id,
        string barberName,
        CancellationToken cancellationToken)
    {
        var booking = await LoadTrackedAsync(id, cancellationToken);
        if (booking is null) return Failure("Booking not found.");

        if (booking.Status is BookingStatus.Cancelled or BookingStatus.Completed)
            return Failure("This booking can no longer be reassigned.");

        var barber = await FindBarberAsync(booking.SalonId, barberName, cancellationToken);
        if (barber is null) return Failure("Selected barber is not active.");

        var validation = await ValidateBarberAsync(
            booking.SalonId,
            barber,
            booking.Services.Where(x => x.ServiceId.HasValue).Select(x => x.ServiceId!.Value).ToList(),
            booking.AppointmentDate,
            booking.StartTime,
            booking.TotalDurationMinutes,
            booking.Id,
            cancellationToken);

        if (!validation.Success) return Failure(validation.Message);

        booking.BarberId = barber.Id;
        booking.Barber = barber;

        await db.SaveChangesAsync(cancellationToken);
        return Success(barber.FullName + " assigned successfully.", Map(booking));
    }

    public async Task<BookingMutationResponse> RescheduleAsync(
        long id,
        string dateValue,
        string timeValue,
        CancellationToken cancellationToken)
    {
        var booking = await LoadTrackedAsync(id, cancellationToken);
        if (booking is null) return Failure("Booking not found.");

        if (booking.Status is BookingStatus.Cancelled or BookingStatus.Completed)
            return Failure("This booking can no longer be rescheduled.");

        if (!TryParseDate(dateValue, out var date) || !TryParseTime(timeValue, out var time))
            return Failure("Please choose both a valid date and time.");

        var salon = await db.Salons
            .AsNoTracking()
            .SingleAsync(x => x.Id == booking.SalonId, cancellationToken);

        var schedule = await ValidateScheduleAsync(
            salon,
            date,
            time,
            booking.TotalDurationMinutes,
            false,
            cancellationToken);

        if (!schedule.Success) return Failure(schedule.Message);

        var validation = await ValidateBarberAsync(
            booking.SalonId,
            booking.Barber,
            booking.Services.Where(x => x.ServiceId.HasValue).Select(x => x.ServiceId!.Value).ToList(),
            date,
            time,
            booking.TotalDurationMinutes,
            booking.Id,
            cancellationToken);

        if (!validation.Success) return Failure(validation.Message);

        booking.AppointmentDate = date;
        booking.StartTime = time;

        await db.SaveChangesAsync(cancellationToken);
        return Success("Appointment rescheduled successfully.", Map(booking));
    }

    public async Task<BookingMutationResponse> UpdateSpecialServicePriceAsync(
        long id,
        decimal amount,
        CancellationToken cancellationToken)
    {
        var booking = await LoadTrackedAsync(id, cancellationToken);
        if (booking is null) return Failure("Booking not found.");

        if (booking.Status is BookingStatus.Completed or BookingStatus.Cancelled)
            return Failure("Closed bookings cannot be repriced.");

        if (booking.ServiceLocation != ServiceLocation.Home || string.IsNullOrWhiteSpace(booking.SpecialService))
            return Failure("This booking does not contain a custom home-service request.");

        if (amount <= 0 || decimal.Truncate(amount) != amount)
            return Failure("Enter a whole-rupee custom service amount greater than 0.");

        var previous = booking.SpecialServiceAmount ?? 0;
        booking.SpecialServiceAmount = amount;
        booking.TotalAmount = Math.Max(0, booking.TotalAmount - previous) + amount;

        await db.SaveChangesAsync(cancellationToken);
        return Success("Custom home-service price updated.", Map(booking));
    }

    public async Task<IReadOnlyList<WalkInBarberOptionDto>> GetWalkInOptionsAsync(
        string serviceName,
        string dateValue,
        string timeValue,
        int duration,
        int preferredWaitMinutes,
        CancellationToken cancellationToken)
    {
        var salon = await GetSalonAsync(cancellationToken);

        if (!TryParseDate(dateValue, out var date) || !TryParseTime(timeValue, out var requestedTime))
            return [];

        var service = await db.Services
            .AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.SalonId == salon.Id && x.IsActive && x.Name == serviceName,
                cancellationToken);

        if (service is null) return [];

        var actualDuration = duration > 0 ? duration : service.DurationMinutes;

        var businessHour = await db.BusinessHours
            .AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.SalonId == salon.Id && x.DayOfWeek == date.DayOfWeek && x.IsOpen,
                cancellationToken);

        if (businessHour?.OpenTime is null || businessHour.CloseTime is null) return [];

        var latestStartMinutes =
            Minutes(businessHour.CloseTime.Value) - actualDuration;
        var requestedMinutes = Minutes(requestedTime);

        if (requestedMinutes > latestStartMinutes) return [];

        var eligible = await db.Barbers
            .AsNoTracking()
            .Where(x => x.SalonId == salon.Id && x.IsActive)
            .Where(x => x.Services.Any(bs => bs.ServiceId == service.Id))
            .OrderByDescending(x => x.Rating)
            .ThenBy(x => x.Id)
            .ToListAsync(cancellationToken);

        var options = new List<(WalkInBarberOptionDto Option, decimal Rating, Guid Id)>();

        foreach (var barber in eligible)
        {
            var maxWait = Math.Max(0, latestStartMinutes - requestedMinutes);

            for (var wait = 0; wait <= maxWait; wait++)
            {
                var start = FromMinutes(requestedMinutes + wait);

                var validation = await ValidateBarberAsync(
                    salon.Id,
                    barber,
                    [service.Id],
                    date,
                    start,
                    actualDuration,
                    null,
                    cancellationToken);

                if (!validation.Success) continue;

                options.Add((
                    new WalkInBarberOptionDto(
                        barber.FullName,
                        FormatTime(start),
                        wait,
                        wait == 0),
                    barber.Rating,
                    barber.Id));

                break;
            }
        }

        var availableNow = options.Where(x => x.Option.AvailableNow).ToList();
        if (availableNow.Count > 0)
        {
            return availableNow
                .OrderByDescending(x => x.Rating)
                .ThenBy(x => x.Id)
                .Select(x => x.Option)
                .ToList();
        }

        var shortWait = options
            .Where(x => x.Option.WaitMinutes > 0 && x.Option.WaitMinutes <= preferredWaitMinutes)
            .ToList();

        var visible = shortWait.Count > 0
            ? shortWait
            : options.Where(x => x.Option.WaitMinutes > 0).ToList();

        return visible
            .OrderBy(x => x.Option.WaitMinutes)
            .ThenByDescending(x => x.Rating)
            .ThenBy(x => x.Id)
            .Select(x => x.Option)
            .ToList();
    }

    private async Task<BookingMutationResponse> CreateAsync(
        CreateBookingsRequest request,
        BookingSource source,
        bool walkIn,
        CancellationToken cancellationToken)
    {
        var strategy = db.Database.CreateExecutionStrategy();

        return await strategy.ExecuteAsync(async () =>
            await CreateWithinTransactionAsync(request, source, walkIn, cancellationToken));
    }

    private async Task<BookingMutationResponse> CreateWithinTransactionAsync(
        CreateBookingsRequest request,
        BookingSource source,
        bool walkIn,
        CancellationToken cancellationToken)
    {
        if (request.Bookings.Count == 0)
            return Failure("No booking details were provided.");

        var salon = await GetSalonAsync(cancellationToken);

        await using var transaction = await db.Database.BeginTransactionAsync(
            IsolationLevel.Serializable,
            cancellationToken);

        var created = new List<Booking>();
        var staged = new List<(Guid BarberId, DateOnly Date, TimeOnly Start, int Duration)>();

        foreach (var input in request.Bookings)
        {
            if (string.IsNullOrWhiteSpace(input.CustomerName))
                return await RollbackFailureAsync(transaction, "Customer name is required.", cancellationToken);

            if (!TryParseDate(input.Date, out var date) || !TryParseTime(input.Time, out var time))
                return await RollbackFailureAsync(transaction, "Invalid booking date or time.", cancellationToken);

            var serviceLocation = ParseServiceLocation(input.ServiceLocation);

            var requestedNames = input.Service
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var services = requestedNames.Count == 0
                ? []
                : await db.Services
                    .Where(x => x.SalonId == salon.Id && x.IsActive && requestedNames.Contains(x.Name))
                    .ToListAsync(cancellationToken);

            var standardIds = services.Select(x => x.Id).ToList();
            var hasUnknownService = requestedNames.Any(name =>
                services.All(service => !string.Equals(service.Name, name, StringComparison.OrdinalIgnoreCase)));

            var isCustomHome =
                serviceLocation == ServiceLocation.Home
                && (!string.IsNullOrWhiteSpace(input.SpecialService) || hasUnknownService);

            if (hasUnknownService && !isCustomHome)
            {
                return await RollbackFailureAsync(
                    transaction,
                    "One or more selected services are not available.",
                    cancellationToken);
            }

            var standardDuration = services.Sum(x => x.DurationMinutes);
            var duration = isCustomHome
                ? Math.Max(standardDuration, input.Duration)
                : standardDuration;

            if (duration <= 0)
                duration = input.Duration;

            if (duration <= 0)
                return await RollbackFailureAsync(transaction, "Booking duration is invalid.", cancellationToken);

            var standardAmount = services.Sum(service =>
                EffectivePrice(service, serviceLocation));

            var amount = isCustomHome
                ? Math.Max(standardAmount, input.Amount)
                : standardAmount;

            if (amount < 0)
                return await RollbackFailureAsync(transaction, "Booking amount is invalid.", cancellationToken);

            var schedule = await ValidateScheduleAsync(
                salon,
                date,
                time,
                duration,
                walkIn,
                cancellationToken);

            if (!schedule.Success)
                return await RollbackFailureAsync(transaction, schedule.Message, cancellationToken);

            var barber = await FindBarberAsync(salon.Id, input.Barber, cancellationToken);
            if (barber is null)
                return await RollbackFailureAsync(transaction, input.Barber + " is not active.", cancellationToken);

            var barberValidation = await ValidateBarberAsync(
                salon.Id,
                barber,
                standardIds,
                date,
                time,
                duration,
                null,
                cancellationToken);

            if (!barberValidation.Success)
                return await RollbackFailureAsync(transaction, barberValidation.Message, cancellationToken);

            var proposedEnd = Minutes(time) + duration;
            if (staged.Any(x =>
                x.BarberId == barber.Id
                && x.Date == date
                && Minutes(x.Start) < proposedEnd
                && Minutes(time) < Minutes(x.Start) + x.Duration))
            {
                return await RollbackFailureAsync(
                    transaction,
                    barber.FullName + " already has an overlapping appointment at this time.",
                    cancellationToken);
            }

            var customer = await FindOrCreateCustomerAsync(
                salon.Id,
                input.CustomerName,
                input.Phone,
                cancellationToken);

            var specialAmount = input.SpecialServiceAmount;

            var status = source == BookingSource.WalkIn
                ? BookingStatus.Confirmed
                : isCustomHome && !string.IsNullOrWhiteSpace(input.SpecialService) && !(specialAmount > 0)
                    ? BookingStatus.Pending
                    : (salon.Settings?.AutoConfirmBookings ?? true)
                        ? BookingStatus.Confirmed
                        : BookingStatus.Pending;

            var booking = new Booking
            {
                SalonId = salon.Id,
                CustomerId = customer?.Id,
                BarberId = barber.Id,
                Barber = barber,
                BookingCode = GenerateBookingCode(),
                CustomerName = input.CustomerName.Trim(),
                CustomerPhone = string.IsNullOrWhiteSpace(input.Phone) ? null : input.Phone.Trim(),
                AppointmentDate = date,
                StartTime = time,
                TotalDurationMinutes = duration,
                TotalAmount = amount,
                Status = status,
                Source = source,
                ServiceLocation = serviceLocation,
                GroupSize = Math.Max(1, input.GroupSize),
                Notes = string.IsNullOrWhiteSpace(input.Notes) ? null : input.Notes.Trim(),
                ServiceAddress = string.IsNullOrWhiteSpace(input.ServiceAddress) ? null : input.ServiceAddress.Trim(),
                SpecialService = string.IsNullOrWhiteSpace(input.SpecialService) ? null : input.SpecialService.Trim(),
                SpecialServiceAmount = specialAmount
            };

            if (services.Count > 0)
            {
                var sort = 0;
                foreach (var service in services.OrderBy(x =>
                             requestedNames.FindIndex(name =>
                                 string.Equals(name, x.Name, StringComparison.OrdinalIgnoreCase))))
                {
                    booking.Services.Add(new BookingService
                    {
                        ServiceId = service.Id,
                        ServiceName = service.Name,
                        DurationMinutes = service.DurationMinutes,
                        Amount = EffectivePrice(service, serviceLocation),
                        SortOrder = sort++
                    });
                }
            }
            else
            {
                booking.Services.Add(new BookingService
                {
                    ServiceName = string.IsNullOrWhiteSpace(input.Service)
                        ? "Custom Home Service"
                        : input.Service.Trim(),
                    DurationMinutes = duration,
                    Amount = amount,
                    SortOrder = 0
                });
            }

            db.Bookings.Add(booking);
            created.Add(booking);
            staged.Add((barber.Id, date, time, duration));
        }

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        var dtos = created.Select(Map).ToList();
        var message = dtos.Count > 1
            ? dtos.Count + " appointments booked successfully."
            : source == BookingSource.WalkIn
                ? "Walk-in customer booked successfully."
                : "Booking created successfully.";

        return new BookingMutationResponse(
            true,
            message,
            dtos.Count == 1 ? dtos[0] : null,
            dtos);
    }

    private async Task<(bool Success, string Message)> ValidateScheduleAsync(
        Salon salon,
        DateOnly date,
        TimeOnly start,
        int duration,
        bool walkIn,
        CancellationToken cancellationToken)
    {
        var settings = salon.Settings
            ?? await db.SalonSettings.AsNoTracking()
                .SingleAsync(x => x.SalonId == salon.Id, cancellationToken);

        var now = GetSalonNow(salon.TimeZone);
        var today = DateOnly.FromDateTime(now);

        if (date < today) return (false, "The selected appointment date has already passed.");

        if (!walkIn && date == today && !settings.AllowSameDayBooking)
            return (false, "Same-day booking is currently disabled.");

        if (!walkIn && date > today.AddDays(settings.MaxAdvanceDays))
            return (false, "This date is outside the current booking window.");

        if (date == today)
        {
            var nowMinutes = now.Hour * 60 + now.Minute;
            var startMinutes = Minutes(start);

            if ((!walkIn && startMinutes <= nowMinutes) || (walkIn && startMinutes < nowMinutes))
                return (false, "The selected appointment time has already passed.");
        }

        var hours = await db.BusinessHours
            .AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.SalonId == salon.Id && x.DayOfWeek == date.DayOfWeek,
                cancellationToken);

        if (hours is null || !hours.IsOpen || hours.OpenTime is null || hours.CloseTime is null)
            return (false, "The salon is closed on this date.");

        var endMinutes = Minutes(start) + duration;
        if (Minutes(start) < Minutes(hours.OpenTime.Value) || endMinutes > Minutes(hours.CloseTime.Value))
            return (false, "The appointment does not fit inside salon opening hours.");

        return (true, string.Empty);
    }

    private async Task<(bool Success, string Message)> ValidateBarberAsync(
        Guid salonId,
        Barber barber,
        IReadOnlyCollection<Guid> serviceIds,
        DateOnly date,
        TimeOnly start,
        int duration,
        Guid? ignoreBookingId,
        CancellationToken cancellationToken)
    {
        if (!barber.IsActive)
            return (false, barber.FullName + " is not active.");

        if (serviceIds.Count > 0)
        {
            var supportedCount = await db.BarberServices
                .AsNoTracking()
                .CountAsync(
                    x => x.BarberId == barber.Id && serviceIds.Contains(x.ServiceId),
                    cancellationToken);

            if (supportedCount != serviceIds.Count)
                return (false, barber.FullName + " does not provide all selected services.");
        }

        var overrideRow = await db.BarberScheduleOverrides
            .AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.BarberId == barber.Id && x.Date == date,
                cancellationToken);

        if (overrideRow is { IsAvailable: false })
            return (false, barber.FullName + " is not available on this date.");

        var onLeave = await db.BarberLeaves
            .AsNoTracking()
            .AnyAsync(
                x => x.BarberId == barber.Id
                     && x.StartDate <= date
                     && x.EndDate >= date,
                cancellationToken);

        if (onLeave)
            return (false, barber.FullName + " is on leave on this date.");

        var workingHours = await db.BarberWorkingHours
            .AsNoTracking()
            .SingleOrDefaultAsync(
                x => x.BarberId == barber.Id && x.DayOfWeek == date.DayOfWeek,
                cancellationToken);

        if (workingHours is not null)
        {
            if (!workingHours.IsWorking || workingHours.StartTime is null || workingHours.EndTime is null)
                return (false, barber.FullName + " is not working on this date.");

            var endMinutes = Minutes(start) + duration;
            if (
                Minutes(start) < Minutes(workingHours.StartTime.Value)
                || endMinutes > Minutes(workingHours.EndTime.Value)
            )
            {
                return (false, barber.FullName + " is outside their configured working hours at this time.");
            }
        }

        var sameDay = await db.Bookings
            .AsNoTracking()
            .Where(x =>
                x.SalonId == salonId
                && x.BarberId == barber.Id
                && x.AppointmentDate == date
                && x.Status != BookingStatus.Cancelled
                && (!ignoreBookingId.HasValue || x.Id != ignoreBookingId.Value))
            .Select(x => new { x.StartTime, x.TotalDurationMinutes })
            .ToListAsync(cancellationToken);

        var requestedStart = Minutes(start);
        var requestedEnd = requestedStart + duration;

        var conflict = sameDay.Any(existing =>
            Minutes(existing.StartTime) < requestedEnd
            && requestedStart < Minutes(existing.StartTime) + existing.TotalDurationMinutes);

        if (conflict)
            return (false, barber.FullName + " already has an overlapping appointment at this time.");

        return (true, string.Empty);
    }

    private async Task<Booking?> LoadTrackedAsync(long publicId, CancellationToken cancellationToken)
    {
        var salon = await GetSalonAsync(cancellationToken);

        return await db.Bookings
            .Where(x => x.SalonId == salon.Id && x.PublicId == publicId)
            .Include(x => x.Barber)
            .Include(x => x.Services)
            .SingleOrDefaultAsync(cancellationToken);
    }

    private async Task<Salon> GetSalonAsync(CancellationToken cancellationToken)
    {
        return await db.Salons
            .Include(x => x.Settings)
            .SingleAsync(x => x.Slug == _salonSlug && x.IsActive, cancellationToken);
    }

    private async Task<Barber?> FindBarberAsync(
        Guid salonId,
        string name,
        CancellationToken cancellationToken)
    {
        var normalized = name.Trim();

        return await db.Barbers
            .SingleOrDefaultAsync(
                x => x.SalonId == salonId && x.IsActive && x.FullName == normalized,
                cancellationToken);
    }

    private async Task<Customer?> FindOrCreateCustomerAsync(
        Guid salonId,
        string fullName,
        string? phone,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(phone)) return null;

        var normalizedPhone = NormalizePhone(phone);

        var customers = await db.Customers
            .Where(x => x.SalonId == salonId && x.Phone != null)
            .ToListAsync(cancellationToken);

        var customer = customers.FirstOrDefault(x => NormalizePhone(x.Phone!) == normalizedPhone);

        if (customer is not null)
        {
            customer.FullName = fullName.Trim();
            customer.Phone = phone.Trim();
            return customer;
        }

        customer = new Customer
        {
            SalonId = salonId,
            FullName = fullName.Trim(),
            Phone = phone.Trim()
        };

        db.Customers.Add(customer);
        return customer;
    }

    private static decimal EffectivePrice(Service service, ServiceLocation location)
    {
        if (location == ServiceLocation.Home && service.HomeServiceEnabled)
        {
            if (service.HomeDiscountPrice is > 0) return service.HomeDiscountPrice.Value;
            if (service.HomeOriginalPrice is > 0) return service.HomeOriginalPrice.Value;
        }

        return service.DiscountPrice is > 0
            ? service.DiscountPrice.Value
            : service.OriginalPrice;
    }

    private static ServiceLocation ParseServiceLocation(string? value)
    {
        return string.Equals(value, "Home", StringComparison.OrdinalIgnoreCase)
            ? ServiceLocation.Home
            : ServiceLocation.Salon;
    }

    private static DateTime GetSalonNow(string timeZoneId)
    {
        try
        {
            var zone = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
            return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zone);
        }
        catch (TimeZoneNotFoundException)
        {
            return DateTime.UtcNow;
        }
        catch (InvalidTimeZoneException)
        {
            return DateTime.UtcNow;
        }
    }

    private static bool TryParseDate(string value, out DateOnly date)
    {
        return DateOnly.TryParseExact(
            value,
            "yyyy-MM-dd",
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out date);
    }

    private static bool TryParseTime(string value, out TimeOnly time)
    {
        return TimeOnly.TryParseExact(
            value,
            ["h:mm tt", "hh:mm tt"],
            CultureInfo.InvariantCulture,
            DateTimeStyles.AllowWhiteSpaces,
            out time);
    }

    private static string FormatDate(DateOnly value) =>
        value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    private static string FormatTime(TimeOnly value) =>
        value.ToString("h:mm tt", CultureInfo.InvariantCulture);

    private static int Minutes(TimeOnly value) => value.Hour * 60 + value.Minute;

    private static TimeOnly FromMinutes(int minutes)
    {
        var normalized = ((minutes % 1440) + 1440) % 1440;
        return new TimeOnly(normalized / 60, normalized % 60);
    }

    private static string NormalizePhone(string value) =>
        new(value.Where(char.IsDigit).ToArray());

    private static string GenerateBookingCode() =>
        "RB-" + DateTime.UtcNow.ToString("yyyyMMdd", CultureInfo.InvariantCulture)
        + "-" + Guid.NewGuid().ToString("N")[..6].ToUpperInvariant();

    private static string SourceLabel(BookingSource source) =>
        source == BookingSource.WalkIn ? "Walk-in" : source.ToString();

    private static BookingDto Map(Booking booking)
    {
        var service = string.Join(
            ", ",
            booking.Services
                .OrderBy(x => x.SortOrder)
                .Select(x => x.ServiceName));

        return new BookingDto(
            booking.PublicId,
            booking.BookingCode,
            booking.CustomerName,
            booking.CustomerPhone ?? string.Empty,
            service,
            booking.TotalDurationMinutes,
            booking.Barber.FullName,
            FormatDate(booking.AppointmentDate),
            FormatTime(booking.StartTime),
            booking.TotalAmount,
            booking.Status.ToString(),
            SourceLabel(booking.Source),
            booking.Notes,
            booking.GroupSize,
            booking.ServiceLocation.ToString(),
            booking.ServiceAddress,
            booking.SpecialService,
            booking.SpecialServiceAmount);
    }

    private static BookingMutationResponse Failure(string message) =>
        new(false, message);

    private static BookingMutationResponse Success(string message, BookingDto booking) =>
        new(true, message, booking, [booking]);

    private static async Task<BookingMutationResponse> RollbackFailureAsync(
        Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction transaction,
        string message,
        CancellationToken cancellationToken)
    {
        await transaction.RollbackAsync(cancellationToken);
        return Failure(message);
    }
}

using System.Globalization;
using BarberFlow.Api.Contracts.Catalog;
using BarberFlow.Api.Data;
using BarberFlow.Api.Domain.Entities;
using BarberFlow.Api.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace BarberFlow.Api.Services;

public sealed class CatalogApplicationService(BarberFlowDbContext db)
{
    private const string DefaultSalonSlug = "royal-barbers";

    public async Task<IReadOnlyList<ServiceDto>> GetServicesAsync(CancellationToken cancellationToken)
    {
        var salonId = await GetSalonIdAsync(cancellationToken);
        var services = await db.Services
            .AsNoTracking()
            .Where(x => x.SalonId == salonId)
            .OrderBy(x => x.PublicId)
            .ToListAsync(cancellationToken);

        return services.Select(MapService).ToList();
    }

    public async Task<MutationResponse<ServiceDto>> AddServiceAsync(
        ServiceUpsertRequest request,
        CancellationToken cancellationToken)
    {
        var salonId = await GetSalonIdAsync(cancellationToken);
        var validation = ValidateService(request);
        if (validation is not null) return new(false, validation);

        var duplicate = await db.Services.AnyAsync(
            x => x.SalonId == salonId && x.Name.ToLower() == request.Name.Trim().ToLower(),
            cancellationToken);
        if (duplicate) return new(false, "A service with this name already exists.");

        var nextId = (await db.Services
            .Where(x => x.SalonId == salonId)
            .MaxAsync(x => (int?)x.PublicId, cancellationToken) ?? 0) + 1;

        var service = BuildService(salonId, nextId, request);
        db.Services.Add(service);
        await db.SaveChangesAsync(cancellationToken);

        return new(true, service.Name + " added successfully.", MapService(service));
    }

    public async Task<MutationResponse<ServiceDto>> UpdateServiceAsync(
        int publicId,
        ServiceUpsertRequest request,
        CancellationToken cancellationToken)
    {
        var salonId = await GetSalonIdAsync(cancellationToken);
        var service = await db.Services.FirstOrDefaultAsync(
            x => x.SalonId == salonId && x.PublicId == publicId,
            cancellationToken);
        if (service is null) return new(false, "Service not found.");

        var validation = ValidateService(request);
        if (validation is not null) return new(false, validation);

        var duplicate = await db.Services.AnyAsync(
            x => x.SalonId == salonId
                 && x.PublicId != publicId
                 && x.Name.ToLower() == request.Name.Trim().ToLower(),
            cancellationToken);
        if (duplicate) return new(false, "Another service already uses this name.");

        ApplyService(service, request);
        await db.SaveChangesAsync(cancellationToken);

        return new(true, service.Name + " updated successfully.", MapService(service));
    }

    public async Task<MutationResponse<ServiceDto>> ToggleServiceStatusAsync(
        int publicId,
        CancellationToken cancellationToken)
    {
        var salonId = await GetSalonIdAsync(cancellationToken);
        var service = await db.Services.FirstOrDefaultAsync(
            x => x.SalonId == salonId && x.PublicId == publicId,
            cancellationToken);
        if (service is null) return new(false, "Service not found.");

        service.IsActive = !service.IsActive;
        await db.SaveChangesAsync(cancellationToken);

        return new(
            true,
            service.Name + " is now " + (service.IsActive ? "active." : "inactive."),
            MapService(service));
    }

    public async Task<MutationResponse> DeleteServiceAsync(
        int publicId,
        CancellationToken cancellationToken)
    {
        var salonId = await GetSalonIdAsync(cancellationToken);
        var service = await db.Services.FirstOrDefaultAsync(
            x => x.SalonId == salonId && x.PublicId == publicId,
            cancellationToken);
        if (service is null) return new(false, "Service not found.");

        var today = DateOnly.FromDateTime(GetSalonNow(await GetSalonAsync(cancellationToken)).DateTime);
        var usedByUpcomingBooking = await db.BookingServices.AnyAsync(
            x => x.ServiceId == service.Id
                 && x.Booking.AppointmentDate >= today
                 && (x.Booking.Status == BookingStatus.Pending || x.Booking.Status == BookingStatus.Confirmed),
            cancellationToken);

        if (usedByUpcomingBooking)
            return new(false, "Complete, cancel or move upcoming bookings before deleting this service.");

        var links = await db.BarberServices.Where(x => x.ServiceId == service.Id).ToListAsync(cancellationToken);
        db.BarberServices.RemoveRange(links);
        db.Services.Remove(service);
        await db.SaveChangesAsync(cancellationToken);

        return new(true, service.Name + " deleted successfully.");
    }

    public async Task<IReadOnlyList<BarberDto>> GetBarbersAsync(CancellationToken cancellationToken)
    {
        var salon = await GetSalonAsync(cancellationToken);
        var barbers = await db.Barbers
            .AsNoTracking()
            .Where(x => x.SalonId == salon.Id)
            .Include(x => x.Services).ThenInclude(x => x.Service)
            .Include(x => x.WorkingHours)
            .Include(x => x.ScheduleOverrides)
            .Include(x => x.Leaves)
            .OrderBy(x => x.PublicId)
            .ToListAsync(cancellationToken);

        var today = DateOnly.FromDateTime(GetSalonNow(salon).DateTime);
        return barbers.Select(x => MapBarber(x, today)).ToList();
    }

    public async Task<MutationResponse<BarberDto>> AddBarberAsync(
        BarberUpsertRequest request,
        CancellationToken cancellationToken)
    {
        var salon = await GetSalonAsync(cancellationToken);
        var validation = await ValidateBarberRequestAsync(salon.Id, null, request, cancellationToken);
        if (validation is not null) return new(false, validation);

        var nextId = (await db.Barbers
            .Where(x => x.SalonId == salon.Id)
            .MaxAsync(x => (int?)x.PublicId, cancellationToken) ?? 0) + 1;

        var barber = new Barber
        {
            SalonId = salon.Id,
            PublicId = nextId,
            FullName = request.Name.Trim(),
            Phone = NormalizePhone(request.Phone),
            ExperienceYears = ExperienceYears(request.Experience),
            ImageUrl = request.Image,
            Rating = NormalizeRating(request.Rating),
            IsActive = !request.AccountStatus.Equals("Inactive", StringComparison.OrdinalIgnoreCase)
        };

        db.Barbers.Add(barber);
        await ApplyBarberServicesAsync(barber, request.Specialties, cancellationToken);
        ApplyWorkingHours(barber, request.WorkingHours);
        ApplyImportedAvailability(barber, request, DateOnly.FromDateTime(GetSalonNow(salon).DateTime));

        await db.SaveChangesAsync(cancellationToken);
        await ReloadBarberGraphAsync(barber, cancellationToken);

        return new(true, barber.FullName + " added successfully.", MapBarber(
            barber,
            DateOnly.FromDateTime(GetSalonNow(salon).DateTime)));
    }

    public async Task<MutationResponse<BarberDto>> UpdateBarberAsync(
        int publicId,
        BarberUpsertRequest request,
        CancellationToken cancellationToken)
    {
        var salon = await GetSalonAsync(cancellationToken);
        var barber = await db.Barbers
            .Include(x => x.Services)
            .Include(x => x.WorkingHours)
            .Include(x => x.ScheduleOverrides)
            .Include(x => x.Leaves)
            .FirstOrDefaultAsync(x => x.SalonId == salon.Id && x.PublicId == publicId, cancellationToken);

        if (barber is null) return new(false, "Barber not found.");

        var validation = await ValidateBarberRequestAsync(salon.Id, publicId, request, cancellationToken);
        if (validation is not null) return new(false, validation);

        barber.FullName = request.Name.Trim();
        barber.Phone = NormalizePhone(request.Phone);
        barber.ExperienceYears = ExperienceYears(request.Experience);
        barber.ImageUrl = request.Image;
        barber.Rating = NormalizeRating(request.Rating);

        await SyncBarberServicesAsync(barber, request.Specialties, cancellationToken);
        UpdateWorkingHours(barber, request.WorkingHours);

        await db.SaveChangesAsync(cancellationToken);
        await ReloadBarberGraphAsync(barber, cancellationToken);

        return new(true, barber.FullName + " updated successfully.", MapBarber(
            barber,
            DateOnly.FromDateTime(GetSalonNow(salon).DateTime)));
    }

    public async Task<MutationResponse> DeleteBarberAsync(int publicId, CancellationToken cancellationToken)
    {
        var salon = await GetSalonAsync(cancellationToken);
        var barber = await db.Barbers
            .Include(x => x.Services)
            .Include(x => x.WorkingHours)
            .Include(x => x.ScheduleOverrides)
            .Include(x => x.Leaves)
            .FirstOrDefaultAsync(x => x.SalonId == salon.Id && x.PublicId == publicId, cancellationToken);

        if (barber is null) return new(false, "Barber not found.");

        var today = DateOnly.FromDateTime(GetSalonNow(salon).DateTime);
        var upcoming = await db.Bookings.AnyAsync(
            x => x.BarberId == barber.Id
                 && x.AppointmentDate >= today
                 && (x.Status == BookingStatus.Pending || x.Status == BookingStatus.Confirmed),
            cancellationToken);

        if (upcoming)
            return new(false, "Reassign or cancel upcoming bookings before deleting this barber.");

        db.BarberServices.RemoveRange(barber.Services);
        db.BarberWorkingHours.RemoveRange(barber.WorkingHours);
        db.BarberScheduleOverrides.RemoveRange(barber.ScheduleOverrides);
        db.BarberLeaves.RemoveRange(barber.Leaves);
        db.Barbers.Remove(barber);
        await db.SaveChangesAsync(cancellationToken);

        return new(true, barber.FullName + " removed from the barber list.");
    }

    public async Task<MutationResponse<BarberDto>> UpdateAvailabilityAsync(
        int publicId,
        string availability,
        CancellationToken cancellationToken)
    {
        var salon = await GetSalonAsync(cancellationToken);
        var barber = await LoadTrackedBarberAsync(salon.Id, publicId, cancellationToken);
        if (barber is null) return new(false, "Barber not found.");

        var today = DateOnly.FromDateTime(GetSalonNow(salon).DateTime);

        if (availability.Equals("Not Available Today", StringComparison.OrdinalIgnoreCase))
        {
            var hasBooking = await db.Bookings.AnyAsync(
                x => x.BarberId == barber.Id
                     && x.AppointmentDate == today
                     && (x.Status == BookingStatus.Pending || x.Status == BookingStatus.Confirmed),
                cancellationToken);
            if (hasBooking)
                return new(false, barber.FullName + " has active bookings today. Reassign or cancel them first.");

            db.BarberScheduleOverrides.RemoveRange(barber.ScheduleOverrides.Where(x => x.Date == today));
            barber.ScheduleOverrides.Add(new BarberScheduleOverride
            {
                Date = today,
                IsAvailable = false,
                Reason = "Not Available Today"
            });
        }
        else if (availability.Equals("Available Today", StringComparison.OrdinalIgnoreCase))
        {
            db.BarberScheduleOverrides.RemoveRange(barber.ScheduleOverrides.Where(x => x.Date == today));
            db.BarberLeaves.RemoveRange(barber.Leaves);
        }
        else
        {
            return new(false, "Use the leave endpoint for leave or vacation dates.");
        }

        await db.SaveChangesAsync(cancellationToken);
        await ReloadBarberGraphAsync(barber, cancellationToken);

        return new(true, barber.FullName + " availability updated.", MapBarber(barber, today));
    }

    public async Task<MutationResponse<BarberDto>> UpdateLeaveAsync(
        int publicId,
        BarberLeaveRequest request,
        CancellationToken cancellationToken)
    {
        var salon = await GetSalonAsync(cancellationToken);
        var barber = await LoadTrackedBarberAsync(salon.Id, publicId, cancellationToken);
        if (barber is null) return new(false, "Barber not found.");

        if (!DateOnly.TryParse(request.LeaveFrom, out var from)
            || !DateOnly.TryParse(request.LeaveTo, out var to))
            return new(false, "Select both leave start and end dates.");

        if (to < from) return new(false, "Leave end date cannot be before the start date.");

        if (request.Availability is not ("On Leave" or "Vacation"))
            return new(false, "Leave type must be On Leave or Vacation.");

        var hasBookings = await db.Bookings.AnyAsync(
            x => x.BarberId == barber.Id
                 && x.AppointmentDate >= from
                 && x.AppointmentDate <= to
                 && (x.Status == BookingStatus.Pending || x.Status == BookingStatus.Confirmed),
            cancellationToken);

        if (hasBookings)
            return new(false, "Reassign or cancel active bookings during this leave period first.");

        db.BarberLeaves.RemoveRange(barber.Leaves);
        barber.Leaves.Clear();
        barber.Leaves.Add(new BarberLeave
        {
            StartDate = from,
            EndDate = to,
            LeaveType = request.Availability,
            Reason = request.Note?.Trim()
        });

        await db.SaveChangesAsync(cancellationToken);
        await ReloadBarberGraphAsync(barber, cancellationToken);

        return new(true, barber.FullName + " marked " + request.Availability.ToLowerInvariant() + ".", MapBarber(
            barber,
            DateOnly.FromDateTime(GetSalonNow(salon).DateTime)));
    }

    public async Task<MutationResponse<BarberDto>> ToggleBarberStatusAsync(
        int publicId,
        CancellationToken cancellationToken)
    {
        var salon = await GetSalonAsync(cancellationToken);
        var barber = await LoadTrackedBarberAsync(salon.Id, publicId, cancellationToken);
        if (barber is null) return new(false, "Barber not found.");

        if (barber.IsActive)
        {
            var today = DateOnly.FromDateTime(GetSalonNow(salon).DateTime);
            var upcoming = await db.Bookings.AnyAsync(
                x => x.BarberId == barber.Id
                     && x.AppointmentDate >= today
                     && (x.Status == BookingStatus.Pending || x.Status == BookingStatus.Confirmed),
                cancellationToken);
            if (upcoming)
                return new(false, "Reassign or cancel upcoming bookings before deactivating this barber.");
        }

        barber.IsActive = !barber.IsActive;
        await db.SaveChangesAsync(cancellationToken);
        await ReloadBarberGraphAsync(barber, cancellationToken);

        return new(
            true,
            barber.FullName + " is now " + (barber.IsActive ? "active." : "inactive."),
            MapBarber(barber, DateOnly.FromDateTime(GetSalonNow(salon).DateTime)));
    }

    public async Task<SettingsDto> GetSettingsAsync(CancellationToken cancellationToken)
    {
        var salon = await GetSalonAsync(cancellationToken, includeSettings: true);
        return MapSettings(salon);
    }

    public async Task<MutationResponse<SettingsDto>> SaveSettingsAsync(
        SettingsDto request,
        CancellationToken cancellationToken)
    {
        var salon = await GetSalonAsync(cancellationToken, includeSettings: true);
        var validation = ValidateSettings(request);
        if (validation is not null) return new(false, validation);

        ApplySettings(salon, request);
        await db.SaveChangesAsync(cancellationToken);

        return new(true, "Settings saved successfully.", MapSettings(salon));
    }

    public async Task<MutationResponse<SettingsDto>> ResetSettingsAsync(CancellationToken cancellationToken)
    {
        var salon = await GetSalonAsync(cancellationToken, includeSettings: true);
        var defaults = DefaultSettings();
        ApplySettings(salon, defaults);
        await db.SaveChangesAsync(cancellationToken);
        return new(true, "Settings reset to defaults.", MapSettings(salon));
    }

    public async Task<LegacyImportResponse> ImportLegacyAsync(
        LegacyCatalogImportRequest request,
        CancellationToken cancellationToken)
    {
        var outcome = new LegacyImportResponse(false, false, "Legacy catalog import did not run.");
        var strategy = db.Database.CreateExecutionStrategy();

        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

            try
            {
                var salon = await GetSalonAsync(cancellationToken, includeSettings: true);

                if (request.Services is { Count: > 0 })
                {
                    var existingServices = await db.Services
                        .Where(x => x.SalonId == salon.Id)
                        .ToListAsync(cancellationToken);

                    var importedServiceIds = new HashSet<Guid>();

                    foreach (var dto in request.Services.OrderBy(x => x.Id))
                    {
                        var upsert = new ServiceUpsertRequest(
                            dto.Name,
                            dto.Duration,
                            dto.OriginalPrice,
                            dto.DiscountPrice,
                            dto.HomeServiceEnabled,
                            dto.HomeOriginalPrice,
                            dto.HomeDiscountPrice,
                            dto.Image,
                            dto.Status);

                        var validation = ValidateService(upsert);
                        if (validation is not null)
                            throw new InvalidOperationException(validation);

                        var service = existingServices.FirstOrDefault(x => x.PublicId == dto.Id)
                            ?? existingServices.FirstOrDefault(
                                x => x.Name.Equals(dto.Name, StringComparison.OrdinalIgnoreCase));

                        if (service is null)
                        {
                            service = BuildService(salon.Id, dto.Id, upsert);
                            db.Services.Add(service);
                            existingServices.Add(service);
                        }
                        else
                        {
                            service.PublicId = dto.Id;
                            ApplyService(service, upsert);
                        }

                        importedServiceIds.Add(service.Id);
                    }

                    foreach (var stale in existingServices.Where(x => !importedServiceIds.Contains(x.Id)))
                    {
                        stale.IsActive = false;
                    }

                    await db.SaveChangesAsync(cancellationToken);
                }

                if (request.Barbers is { Count: > 0 })
                {
                    var existingBarbers = await db.Barbers
                        .Where(x => x.SalonId == salon.Id)
                        .Include(x => x.Services)
                        .Include(x => x.WorkingHours)
                        .Include(x => x.ScheduleOverrides)
                        .Include(x => x.Leaves)
                        .ToListAsync(cancellationToken);

                    var importedBarberIds = new HashSet<Guid>();
                    var today = DateOnly.FromDateTime(GetSalonNow(salon).DateTime);

                    foreach (var dto in request.Barbers.OrderBy(x => x.Id))
                    {
                        var normalizedPhone = NormalizePhone(dto.Phone);
                        var barber = existingBarbers.FirstOrDefault(x => x.PublicId == dto.Id)
                            ?? existingBarbers.FirstOrDefault(
                                x => string.Equals(x.Phone, normalizedPhone, StringComparison.OrdinalIgnoreCase))
                            ?? existingBarbers.FirstOrDefault(
                                x => x.FullName.Equals(dto.Name, StringComparison.OrdinalIgnoreCase));

                        if (barber is null)
                        {
                            barber = new Barber
                            {
                                SalonId = salon.Id,
                                PublicId = dto.Id,
                                FullName = dto.Name.Trim(),
                                Phone = normalizedPhone,
                                ExperienceYears = ExperienceYears(dto.Experience),
                                ImageUrl = dto.Image,
                                Rating = NormalizeRating(dto.Rating),
                                IsActive = !dto.AccountStatus.Equals("Inactive", StringComparison.OrdinalIgnoreCase)
                            };

                            db.Barbers.Add(barber);
                            existingBarbers.Add(barber);
                        }
                        else
                        {
                            barber.PublicId = dto.Id;
                            barber.FullName = dto.Name.Trim();
                            barber.Phone = normalizedPhone;
                            barber.ExperienceYears = ExperienceYears(dto.Experience);
                            barber.ImageUrl = dto.Image;
                            barber.Rating = NormalizeRating(dto.Rating);
                            barber.IsActive = !dto.AccountStatus.Equals("Inactive", StringComparison.OrdinalIgnoreCase);

                            db.BarberServices.RemoveRange(barber.Services);
                            barber.Services.Clear();
                            db.BarberWorkingHours.RemoveRange(barber.WorkingHours);
                            barber.WorkingHours.Clear();
                            db.BarberScheduleOverrides.RemoveRange(barber.ScheduleOverrides);
                            barber.ScheduleOverrides.Clear();
                            db.BarberLeaves.RemoveRange(barber.Leaves);
                            barber.Leaves.Clear();
                        }

                        await ApplyBarberServicesAsync(barber, dto.Specialties, cancellationToken);
                        ApplyWorkingHours(barber, dto.WorkingHours);
                        ApplyImportedAvailability(
                            barber,
                            new BarberUpsertRequest(
                                dto.Name,
                                dto.Phone,
                                dto.Experience,
                                dto.Specialties,
                                dto.WorkingHours,
                                dto.Image,
                                dto.Rating,
                                dto.Availability,
                                dto.AccountStatus,
                                dto.LeaveFrom,
                                dto.LeaveTo,
                                dto.Note),
                            today);

                        importedBarberIds.Add(barber.Id);
                    }

                    foreach (var stale in existingBarbers.Where(x => !importedBarberIds.Contains(x.Id)))
                    {
                        stale.IsActive = false;
                    }

                    await db.SaveChangesAsync(cancellationToken);
                }

                var settingsMessage = "";
                if (request.Settings is not null)
                {
                    var validation = ValidateSettings(request.Settings);
                    if (validation is null)
                    {
                        ApplySettings(salon, request.Settings);
                        await db.SaveChangesAsync(cancellationToken);
                    }
                    else
                    {
                        settingsMessage = " Existing browser settings were not imported because: " + validation;
                    }
                }

                await transaction.CommitAsync(cancellationToken);

                outcome = new LegacyImportResponse(
                    true,
                    true,
                    "Legacy Services, Barbers and Settings were migrated to SQL Server." + settingsMessage);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                db.ChangeTracker.Clear();
                outcome = new LegacyImportResponse(
                    false,
                    false,
                    "Legacy data migration failed: " + ex.Message);
            }
        });

        return outcome;
    }

    private static ServiceDto MapService(Service service) => new(
        service.PublicId,
        service.Name,
        service.DurationMinutes,
        service.OriginalPrice,
        service.DiscountPrice,
        service.HomeServiceEnabled,
        service.HomeOriginalPrice,
        service.HomeDiscountPrice,
        service.ImageUrl ?? "assets/images/service-placeholder.svg",
        service.IsActive ? "Active" : "Inactive");

    private static Service BuildService(Guid salonId, int publicId, ServiceUpsertRequest request)
    {
        var service = new Service { SalonId = salonId, PublicId = publicId, Name = request.Name.Trim() };
        ApplyService(service, request);
        return service;
    }

    private static void ApplyService(Service service, ServiceUpsertRequest request)
    {
        service.Name = request.Name.Trim();
        service.DurationMinutes = request.Duration;
        service.OriginalPrice = request.OriginalPrice;
        service.DiscountPrice = request.DiscountPrice;
        service.HomeServiceEnabled = request.HomeServiceEnabled;
        service.HomeOriginalPrice = request.HomeServiceEnabled ? request.HomeOriginalPrice : null;
        service.HomeDiscountPrice = request.HomeServiceEnabled ? request.HomeDiscountPrice : null;
        service.ImageUrl = request.Image;
        service.IsActive = !request.Status.Equals("Inactive", StringComparison.OrdinalIgnoreCase);
    }

    private static string? ValidateService(ServiceUpsertRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name)) return "Service name is required.";
        if (request.Duration <= 0) return "Enter a valid service duration.";
        if (request.OriginalPrice <= 0) return "Enter a valid original amount.";
        if (request.DiscountPrice is not null
            && (request.DiscountPrice <= 0 || request.DiscountPrice >= request.OriginalPrice))
            return "Discount amount must be greater than 0 and lower than the original amount.";
        if (request.HomeServiceEnabled
            && (!request.HomeOriginalPrice.HasValue || request.HomeOriginalPrice <= 0))
            return "Enter a valid home service amount.";
        if (request.HomeServiceEnabled && request.HomeDiscountPrice is not null
            && (request.HomeDiscountPrice <= 0 || request.HomeDiscountPrice >= request.HomeOriginalPrice))
            return "Home discount amount must be greater than 0 and lower than the home service amount.";
        if (string.IsNullOrWhiteSpace(request.Image)) return "Service image is required.";
        return null;
    }

    private async Task<string?> ValidateBarberRequestAsync(
        Guid salonId,
        int? publicId,
        BarberUpsertRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name)) return "Barber name is required.";
        if (!IsValidPakistanPhone(request.Phone)) return "Enter a valid Pakistan mobile number.";
        if (request.Specialties.Count == 0) return "Select at least one specialty.";
        if (!TryParseWorkingHours(request.WorkingHours, out _, out _))
            return "Enter working hours like 8:00 AM - 9:00 PM.";

        var duplicateName = await db.Barbers.AnyAsync(
            x => x.SalonId == salonId
                 && (!publicId.HasValue || x.PublicId != publicId.Value)
                 && x.FullName.ToLower() == request.Name.Trim().ToLower(),
            cancellationToken);
        if (duplicateName) return "Another barber already uses this name.";

        var normalizedPhone = NormalizePhone(request.Phone);
        var duplicatePhone = await db.Barbers.AnyAsync(
            x => x.SalonId == salonId
                 && (!publicId.HasValue || x.PublicId != publicId.Value)
                 && x.Phone == normalizedPhone,
            cancellationToken);
        if (duplicatePhone) return "Another barber already uses this mobile number.";

        var normalizedSpecialties = request.Specialties.Select(x => x.Trim().ToLower()).Distinct().ToList();
        var serviceCount = await db.Services.CountAsync(
            x => x.SalonId == salonId
                 && normalizedSpecialties.Contains(x.Name.ToLower()),
            cancellationToken);
        if (serviceCount != normalizedSpecialties.Count)
            return "One or more selected specialties do not exist in the service catalog.";

        return null;
    }

    private async Task ApplyBarberServicesAsync(
        Barber barber,
        IReadOnlyList<string> specialties,
        CancellationToken cancellationToken)
    {
        var normalized = specialties.Select(x => x.Trim().ToLower()).Distinct().ToList();
        var services = await db.Services
            .Where(x => x.SalonId == barber.SalonId && normalized.Contains(x.Name.ToLower()))
            .ToListAsync(cancellationToken);

        foreach (var service in services)
            barber.Services.Add(new BarberService { Barber = barber, Service = service });
    }

    private async Task SyncBarberServicesAsync(
        Barber barber,
        IReadOnlyList<string> specialties,
        CancellationToken cancellationToken)
    {
        var normalized = specialties
            .Select(x => x.Trim().ToLower())
            .Distinct()
            .ToList();

        var services = await db.Services
            .Where(x => x.SalonId == barber.SalonId && normalized.Contains(x.Name.ToLower()))
            .ToListAsync(cancellationToken);

        var desiredServiceIds = services.Select(x => x.Id).ToHashSet();
        var removedLinks = barber.Services
            .Where(x => !desiredServiceIds.Contains(x.ServiceId))
            .ToList();

        db.BarberServices.RemoveRange(removedLinks);
        foreach (var link in removedLinks)
            barber.Services.Remove(link);

        var existingServiceIds = barber.Services.Select(x => x.ServiceId).ToHashSet();
        foreach (var service in services.Where(x => !existingServiceIds.Contains(x.Id)))
            barber.Services.Add(new BarberService { Barber = barber, Service = service });
    }

    private static void UpdateWorkingHours(Barber barber, string value)
    {
        if (!TryParseWorkingHours(value, out var start, out var end))
            throw new InvalidOperationException("Invalid barber working hours.");

        foreach (var day in Enum.GetValues<DayOfWeek>())
        {
            var existing = barber.WorkingHours.FirstOrDefault(x => x.DayOfWeek == day);
            if (existing is null)
            {
                barber.WorkingHours.Add(new BarberWorkingHour
                {
                    DayOfWeek = day,
                    IsWorking = true,
                    StartTime = start,
                    EndTime = end
                });
                continue;
            }

            existing.IsWorking = true;
            existing.StartTime = start;
            existing.EndTime = end;
        }
    }

    private static void ApplyWorkingHours(Barber barber, string value)
    {
        if (!TryParseWorkingHours(value, out var start, out var end))
            throw new InvalidOperationException("Invalid barber working hours.");

        foreach (var day in Enum.GetValues<DayOfWeek>())
        {
            barber.WorkingHours.Add(new BarberWorkingHour
            {
                DayOfWeek = day,
                IsWorking = true,
                StartTime = start,
                EndTime = end
            });
        }
    }

    private static void ApplyImportedAvailability(
        Barber barber,
        BarberUpsertRequest request,
        DateOnly today)
    {
        if (request.Availability.Equals("Not Available Today", StringComparison.OrdinalIgnoreCase))
        {
            barber.ScheduleOverrides.Add(new BarberScheduleOverride
            {
                Date = today,
                IsAvailable = false,
                Reason = "Not Available Today"
            });
        }

        if ((request.Availability.Equals("On Leave", StringComparison.OrdinalIgnoreCase)
             || request.Availability.Equals("Vacation", StringComparison.OrdinalIgnoreCase))
            && DateOnly.TryParse(request.LeaveFrom, out var from)
            && DateOnly.TryParse(request.LeaveTo, out var to))
        {
            barber.Leaves.Add(new BarberLeave
            {
                StartDate = from,
                EndDate = to,
                LeaveType = request.Availability,
                Reason = request.Note?.Trim()
            });
        }
    }

    private static BarberDto MapBarber(Barber barber, DateOnly today)
    {
        var leave = barber.Leaves
            .OrderByDescending(x => x.EndDate >= today)
            .ThenBy(x => x.StartDate)
            .FirstOrDefault();

        var unavailableToday = barber.ScheduleOverrides.Any(x => x.Date == today && !x.IsAvailable);

        var availability = !barber.IsActive
            ? "Not Available Today"
            : leave is not null && today >= leave.StartDate && today <= leave.EndDate
                ? leave.LeaveType
                : unavailableToday
                    ? "Not Available Today"
                    : "Available Today";

        var work = barber.WorkingHours
            .Where(x => x.IsWorking && x.StartTime.HasValue && x.EndTime.HasValue)
            .OrderBy(x => x.DayOfWeek)
            .FirstOrDefault();

        var workingHours = work is null
            ? ""
            : FormatTime(work.StartTime!.Value) + " - " + FormatTime(work.EndTime!.Value);

        return new BarberDto(
            barber.PublicId,
            barber.FullName,
            FormatPhone(barber.Phone),
            barber.ExperienceYears is > 0 ? barber.ExperienceYears.Value + "+ years" : "New",
            barber.Services.Select(x => x.Service.Name).OrderBy(x => x).ToList(),
            workingHours,
            barber.ImageUrl ?? "assets/images/barber-placeholder.svg",
            barber.Rating,
            availability,
            barber.IsActive ? "Active" : "Inactive",
            leave?.StartDate.ToString("yyyy-MM-dd"),
            leave?.EndDate.ToString("yyyy-MM-dd"),
            leave?.Reason ?? "");
    }

    private async Task<Barber?> LoadTrackedBarberAsync(
        Guid salonId,
        int publicId,
        CancellationToken cancellationToken)
        => await db.Barbers
            .Include(x => x.Services).ThenInclude(x => x.Service)
            .Include(x => x.WorkingHours)
            .Include(x => x.ScheduleOverrides)
            .Include(x => x.Leaves)
            .FirstOrDefaultAsync(x => x.SalonId == salonId && x.PublicId == publicId, cancellationToken);

    private async Task ReloadBarberGraphAsync(Barber barber, CancellationToken cancellationToken)
    {
        await db.Entry(barber).Collection(x => x.Services).Query().Include(x => x.Service).LoadAsync(cancellationToken);
        await db.Entry(barber).Collection(x => x.WorkingHours).LoadAsync(cancellationToken);
        await db.Entry(barber).Collection(x => x.ScheduleOverrides).LoadAsync(cancellationToken);
        await db.Entry(barber).Collection(x => x.Leaves).LoadAsync(cancellationToken);
    }

    private static SettingsDto MapSettings(Salon salon)
    {
        var settings = salon.Settings ?? new SalonSettings { SalonId = salon.Id };
        var hours = Enum.GetValues<DayOfWeek>()
            .Select(day =>
            {
                var saved = salon.BusinessHours.FirstOrDefault(x => x.DayOfWeek == day);
                return new BusinessHoursDayDto(
                    day.ToString().ToLowerInvariant(),
                    day.ToString(),
                    saved?.IsOpen == true,
                    saved?.OpenTime?.ToString("HH:mm") ?? "08:00",
                    saved?.CloseTime?.ToString("HH:mm") ?? "21:00");
            })
            .OrderBy(x => DayOrder(x.Key))
            .ToList();

        return new SettingsDto(
            salon.Name,
            FormatPhone(salon.Phone),
            FormatPhone(salon.WhatsAppNumber),
            salon.Email ?? "",
            salon.Address ?? "",
            salon.City ?? "",
            salon.CurrencyCode,
            salon.TimeZone,
            settings.BrandSubtitle,
            settings.HeroEyebrow,
            settings.HeroHeadline,
            settings.HeroTagline,
            settings.BookingIntervalMinutes,
            settings.MaxAdvanceDays,
            settings.CancellationHours,
            settings.LateArrivalMinutes,
            settings.AllowSameDayBooking,
            settings.AutoConfirmBookings,
            settings.SendWhatsappConfirmation,
            settings.SendSmsFallback,
            settings.SendAppointmentReminder,
            settings.ReminderHoursBefore,
            settings.NotifyOwnerOnNewBooking,
            hours);
    }

    private static SettingsDto DefaultSettings() => new(
        "Royal Barbers",
        "+92 300 1234567",
        "+92 300 1234567",
        "owner@royalbarbers.local",
        "",
        "",
        "PKR",
        "Asia/Karachi",
        "LOOK GOOD · FEEL GREAT",
        "PREMIUM BARBERSHOP",
        "",
        "More Than a Haircut. It's a Lifestyle.",
        30,
        30,
        2,
        10,
        true,
        true,
        true,
        false,
        true,
        2,
        true,
        Enum.GetValues<DayOfWeek>()
            .Select(day => new BusinessHoursDayDto(
                day.ToString().ToLowerInvariant(),
                day.ToString(),
                true,
                "08:00",
                "21:00"))
            .OrderBy(x => DayOrder(x.Key))
            .ToList());

    private static void ApplySettings(Salon salon, SettingsDto request)
    {
        salon.Name = request.BusinessName.Trim();
        salon.Phone = NormalizePhone(request.BusinessPhone);
        salon.WhatsAppNumber = NormalizePhone(request.WhatsappNumber);
        salon.Email = request.Email.Trim();
        salon.Address = request.Address.Trim();
        salon.City = request.City.Trim();
        salon.CurrencyCode = request.Currency.Trim().ToUpperInvariant();
        salon.TimeZone = request.Timezone.Trim();

        salon.Settings ??= new SalonSettings { SalonId = salon.Id };
        salon.Settings.BookingIntervalMinutes = request.BookingInterval;
        salon.Settings.MaxAdvanceDays = request.MaxAdvanceDays;
        salon.Settings.CancellationHours = request.CancellationHours;
        salon.Settings.LateArrivalMinutes = request.LateArrivalMinutes;
        salon.Settings.AllowSameDayBooking = request.AllowSameDayBooking;
        salon.Settings.AutoConfirmBookings = request.AutoConfirmBookings;
        salon.Settings.BrandSubtitle = request.BrandSubtitle.Trim();
        salon.Settings.HeroEyebrow = request.HeroEyebrow.Trim();
        salon.Settings.HeroHeadline = request.HeroHeadline.Trim();
        salon.Settings.HeroTagline = request.HeroTagline.Trim();
        salon.Settings.SendWhatsappConfirmation = request.SendWhatsappConfirmation;
        salon.Settings.SendSmsFallback = request.SendSmsFallback;
        salon.Settings.SendAppointmentReminder = request.SendAppointmentReminder;
        salon.Settings.ReminderHoursBefore = request.ReminderHoursBefore;
        salon.Settings.NotifyOwnerOnNewBooking = request.NotifyOwnerOnNewBooking;

        var byKey = request.BusinessHours.ToDictionary(x => x.Key.ToLowerInvariant());
        foreach (var day in Enum.GetValues<DayOfWeek>())
        {
            var key = day.ToString().ToLowerInvariant();
            if (!byKey.TryGetValue(key, out var incoming)) continue;

            var entity = salon.BusinessHours.FirstOrDefault(x => x.DayOfWeek == day);
            if (entity is null)
            {
                entity = new BusinessHour { SalonId = salon.Id, DayOfWeek = day };
                salon.BusinessHours.Add(entity);
            }

            entity.IsOpen = incoming.Enabled;
            entity.OpenTime = TimeOnly.TryParseExact(incoming.Open, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var open)
                ? open : null;
            entity.CloseTime = TimeOnly.TryParseExact(incoming.Close, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var close)
                ? close : null;
        }
    }

    private static string? ValidateSettings(SettingsDto request)
    {
        if (string.IsNullOrWhiteSpace(request.BusinessName)) return "Business name is required.";
        if (!IsValidPakistanPhone(request.BusinessPhone)) return "Enter a valid Pakistan business phone number.";
        if (!IsValidPakistanPhone(request.WhatsappNumber)) return "Enter a valid Pakistan WhatsApp number.";
        if (!string.IsNullOrWhiteSpace(request.Email)
            && !request.Email.Contains('@')) return "Enter a valid email address.";
        if (request.BookingInterval < 5) return "Booking interval must be at least 5 minutes.";
        if (request.MaxAdvanceDays < 1) return "Advance booking window must be at least 1 day.";
        if (request.CancellationHours < 0) return "Cancellation notice cannot be negative.";
        if (request.LateArrivalMinutes < 0) return "Late arrival grace cannot be negative.";
        if (request.SendAppointmentReminder
            && (request.ReminderHoursBefore < 1 || request.ReminderHoursBefore > 72))
            return "Reminder time must be from 1 to 72 hours.";

        foreach (var day in request.BusinessHours.Where(x => x.Enabled))
        {
            if (!TimeOnly.TryParseExact(day.Open, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var open)
                || !TimeOnly.TryParseExact(day.Close, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var close)
                || close <= open)
                return day.Label + " closing time must be later than opening time.";
        }

        return null;
    }

    private async Task<Salon> GetSalonAsync(
        CancellationToken cancellationToken,
        bool includeSettings = false)
    {
        IQueryable<Salon> query = db.Salons
            .Where(x => x.Slug == DefaultSalonSlug && x.IsActive);

        if (includeSettings)
            query = query.Include(x => x.Settings).Include(x => x.BusinessHours);

        return await query.FirstAsync(cancellationToken);
    }

    private async Task<Guid> GetSalonIdAsync(CancellationToken cancellationToken)
        => (await GetSalonAsync(cancellationToken)).Id;

    private static bool TryParseWorkingHours(string value, out TimeOnly start, out TimeOnly end)
    {
        start = default;
        end = default;

        var normalized = (value ?? "")
            .Replace("–", "-")
            .Replace("—", "-")
            .Trim();

        var parts = normalized.Split('-', 2, StringSplitOptions.TrimEntries);
        if (parts.Length != 2) return false;

        return TryParseShiftTime(parts[0], out start)
               && TryParseShiftTime(parts[1], out end)
               && end > start;
    }

    private static bool TryParseShiftTime(string value, out TimeOnly time)
    {
        var formats = new[] { "h tt", "h:mm tt", "hh:mm tt", "HH:mm" };
        return TimeOnly.TryParseExact(
            value.Trim(),
            formats,
            CultureInfo.InvariantCulture,
            DateTimeStyles.AllowWhiteSpaces,
            out time);
    }

    private static string FormatTime(TimeOnly value)
        => DateTime.Today.Add(value.ToTimeSpan()).ToString("h:mm tt", CultureInfo.InvariantCulture);

    private static int ExperienceYears(string value)
        => int.TryParse(new string((value ?? "").TakeWhile(char.IsDigit).ToArray()), out var years)
            ? Math.Max(0, years)
            : 0;

    private static decimal NormalizeRating(decimal rating)
        => Math.Clamp(rating <= 0 ? 5m : rating, 1m, 5m);

    private static bool IsValidPakistanPhone(string value)
    {
        var digits = new string((value ?? "").Where(char.IsDigit).ToArray());
        if (digits.StartsWith("92")) digits = digits[2..];
        return digits.Length == 10 && digits.StartsWith("3");
    }

    private static string NormalizePhone(string? value)
    {
        var digits = new string((value ?? "").Where(char.IsDigit).ToArray());
        if (digits.StartsWith("92")) digits = digits[2..];
        return digits.Length == 10 ? "+92" + digits : value?.Trim() ?? "";
    }

    private static string FormatPhone(string? value)
    {
        var digits = new string((value ?? "").Where(char.IsDigit).ToArray());
        if (digits.StartsWith("92")) digits = digits[2..];
        return digits.Length == 10
            ? "+92 " + digits[..3] + " " + digits[3..]
            : value ?? "";
    }

    private static int DayOrder(string key) => key switch
    {
        "monday" => 1,
        "tuesday" => 2,
        "wednesday" => 3,
        "thursday" => 4,
        "friday" => 5,
        "saturday" => 6,
        "sunday" => 7,
        _ => 8
    };

    private static DateTimeOffset GetSalonNow(Salon salon)
    {
        try
        {
            return TimeZoneInfo.ConvertTime(
                DateTimeOffset.UtcNow,
                TimeZoneInfo.FindSystemTimeZoneById(salon.TimeZone));
        }
        catch
        {
            return DateTimeOffset.UtcNow;
        }
    }
}

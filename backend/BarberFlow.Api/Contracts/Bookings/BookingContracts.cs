namespace BarberFlow.Api.Contracts.Bookings;

public sealed record BookingDto(
    long Id,
    string Code,
    string CustomerName,
    string Phone,
    string Service,
    int Duration,
    string Barber,
    string Date,
    string Time,
    decimal Amount,
    string Status,
    string Source,
    string? Notes,
    int GroupSize,
    string ServiceLocation,
    string? ServiceAddress,
    string? SpecialService,
    decimal? SpecialServiceAmount);

public sealed record BookingInputDto(
    string CustomerName,
    string? Phone,
    string Service,
    int Duration,
    string Barber,
    string Date,
    string Time,
    decimal Amount,
    string? Notes,
    int GroupSize,
    string ServiceLocation,
    string? ServiceAddress,
    string? SpecialService,
    decimal? SpecialServiceAmount);

public sealed record CreateBookingsRequest(IReadOnlyList<BookingInputDto> Bookings);

public sealed record BookingMutationResponse(
    bool Success,
    string Message,
    BookingDto? Booking = null,
    IReadOnlyList<BookingDto>? Bookings = null);

public sealed record UpdateBookingStatusRequest(string Status);
public sealed record AssignBookingBarberRequest(string Barber);
public sealed record RescheduleBookingRequest(string Date, string Time);
public sealed record UpdateSpecialServicePriceRequest(decimal Amount);

public sealed record WalkInBarberOptionDto(
    string Name,
    string StartTime,
    int WaitMinutes,
    bool AvailableNow);

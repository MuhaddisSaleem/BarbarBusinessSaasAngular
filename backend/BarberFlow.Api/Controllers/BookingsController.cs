using BarberFlow.Api.Contracts.Bookings;
using BarberFlow.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace BarberFlow.Api.Controllers;

[ApiController]
[Route("api/bookings")]
public sealed class BookingsController(BookingApplicationService bookingService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<BookingDto>>> GetAll(CancellationToken cancellationToken)
    {
        return Ok(await bookingService.GetAllAsync(cancellationToken));
    }

    [HttpGet("{id:long}")]
    public async Task<ActionResult<BookingDto>> Get(long id, CancellationToken cancellationToken)
    {
        var booking = await bookingService.GetAsync(id, cancellationToken);
        return booking is null ? NotFound() : Ok(booking);
    }

    [HttpPost]
    public async Task<ActionResult<BookingMutationResponse>> Create(
        CreateBookingsRequest request,
        CancellationToken cancellationToken)
    {
        var result = await bookingService.CreateOnlineAsync(request, cancellationToken);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [HttpPost("walk-in")]
    public async Task<ActionResult<BookingMutationResponse>> CreateWalkIn(
        BookingInputDto request,
        CancellationToken cancellationToken)
    {
        var result = await bookingService.CreateWalkInAsync(request, cancellationToken);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [HttpPatch("{id:long}/status")]
    public async Task<ActionResult<BookingMutationResponse>> UpdateStatus(
        long id,
        UpdateBookingStatusRequest request,
        CancellationToken cancellationToken)
    {
        var result = await bookingService.UpdateStatusAsync(id, request.Status, cancellationToken);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [HttpPatch("{id:long}/barber")]
    public async Task<ActionResult<BookingMutationResponse>> AssignBarber(
        long id,
        AssignBookingBarberRequest request,
        CancellationToken cancellationToken)
    {
        var result = await bookingService.AssignBarberAsync(id, request.Barber, cancellationToken);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [HttpPatch("{id:long}/schedule")]
    public async Task<ActionResult<BookingMutationResponse>> Reschedule(
        long id,
        RescheduleBookingRequest request,
        CancellationToken cancellationToken)
    {
        var result = await bookingService.RescheduleAsync(id, request.Date, request.Time, cancellationToken);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [HttpPatch("{id:long}/special-service-price")]
    public async Task<ActionResult<BookingMutationResponse>> UpdateSpecialServicePrice(
        long id,
        UpdateSpecialServicePriceRequest request,
        CancellationToken cancellationToken)
    {
        var result = await bookingService.UpdateSpecialServicePriceAsync(id, request.Amount, cancellationToken);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [HttpGet("walk-in-options")]
    public async Task<ActionResult<IReadOnlyList<WalkInBarberOptionDto>>> WalkInOptions(
        [FromQuery] string service,
        [FromQuery] string date,
        [FromQuery] string time,
        [FromQuery] int duration,
        [FromQuery] int preferredWaitMinutes = 10,
        CancellationToken cancellationToken = default)
    {
        var result = await bookingService.GetWalkInOptionsAsync(
            service,
            date,
            time,
            duration,
            preferredWaitMinutes,
            cancellationToken);

        return Ok(result);
    }
}

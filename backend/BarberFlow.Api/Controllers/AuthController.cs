using BarberFlow.Api.Contracts.Auth;
using BarberFlow.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BarberFlow.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(AuthApplicationService auth) : ControllerBase
{
    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login(
        [FromBody] LoginRequest request,
        CancellationToken cancellationToken)
    {
        var result = await auth.LoginAsync(request, cancellationToken);
        return result.Success ? Ok(result) : Unauthorized(result);
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<AuthUserDto>> Me(CancellationToken cancellationToken)
    {
        var user = await auth.GetCurrentUserAsync(User, cancellationToken);
        return user is null ? Unauthorized() : Ok(user);
    }
}

namespace BarberFlow.Api.Contracts.Auth;

public sealed record LoginRequest(
    string Email,
    string Password,
    bool RememberMe = false
);

public sealed record AuthUserDto(
    Guid Id,
    string FullName,
    string Email,
    string Role
);

public sealed record LoginResponse(
    bool Success,
    string Message,
    string? Token = null,
    DateTimeOffset? ExpiresAt = null,
    AuthUserDto? User = null
);

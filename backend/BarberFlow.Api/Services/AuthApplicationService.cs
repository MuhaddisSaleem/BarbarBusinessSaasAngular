using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using BarberFlow.Api.Contracts.Auth;
using BarberFlow.Api.Data;
using BarberFlow.Api.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace BarberFlow.Api.Services;

public sealed class AuthApplicationService(
    BarberFlowDbContext db,
    IPasswordHasher<SalonUser> passwordHasher,
    IConfiguration configuration)
{
    private const string DefaultSalonSlug = "royal-barbers";

    public async Task<LoginResponse> LoginAsync(
        LoginRequest request,
        CancellationToken cancellationToken)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(request.Password))
            return new(false, "Email and password are required.");

        var user = await db.SalonUsers
            .Include(x => x.Salon)
            .FirstOrDefaultAsync(
                x => x.Salon.Slug == DefaultSalonSlug && x.Email.ToLower() == email,
                cancellationToken);

        if (user is null || !user.IsActive || string.IsNullOrWhiteSpace(user.PasswordHash))
            return new(false, "Invalid email or password.");

        var verification = passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (verification == PasswordVerificationResult.Failed)
            return new(false, "Invalid email or password.");

        if (verification == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = passwordHasher.HashPassword(user, request.Password);
            await db.SaveChangesAsync(cancellationToken);
        }

        var now = DateTimeOffset.UtcNow;
        var expiresAt = request.RememberMe
            ? now.AddDays(configuration.GetValue<int?>("Jwt:RememberMeDays") ?? 7)
            : now.AddMinutes(configuration.GetValue<int?>("Jwt:AccessTokenMinutes") ?? 480);

        var token = CreateToken(user, expiresAt);
        return new(
            true,
            "Login successful.",
            token,
            expiresAt,
            MapUser(user));
    }

    public async Task<AuthUserDto?> GetCurrentUserAsync(
        ClaimsPrincipal principal,
        CancellationToken cancellationToken)
    {
        var rawId = principal.FindFirstValue(ClaimTypes.NameIdentifier)
                    ?? principal.FindFirstValue(JwtRegisteredClaimNames.Sub);

        if (!Guid.TryParse(rawId, out var userId))
            return null;

        var user = await db.SalonUsers
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == userId && x.IsActive, cancellationToken);

        return user is null ? null : MapUser(user);
    }

    private string CreateToken(SalonUser user, DateTimeOffset expiresAt)
    {
        var signingKey = configuration["Jwt:SigningKey"];
        if (string.IsNullOrWhiteSpace(signingKey) || signingKey.Length < 32)
            throw new InvalidOperationException("Jwt:SigningKey must be configured with at least 32 characters.");

        var issuer = configuration["Jwt:Issuer"] ?? "BarberFlow.Api";
        var audience = configuration["Jwt:Audience"] ?? "BarberFlow.Admin";
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim("salon_id", user.SalonId.ToString()),
            new Claim(ClaimTypes.Name, user.FullName),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role.ToString())
        };

        var token = new JwtSecurityToken(
            issuer,
            audience,
            claims,
            notBefore: DateTime.UtcNow,
            expires: expiresAt.UtcDateTime,
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static AuthUserDto MapUser(SalonUser user)
        => new(user.Id, user.FullName, user.Email, user.Role.ToString());
}

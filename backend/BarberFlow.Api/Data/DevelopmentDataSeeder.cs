using BarberFlow.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace BarberFlow.Api.Data;

public static class DevelopmentDataSeeder
{
    public static async Task SeedAsync(BarberFlowDbContext db, CancellationToken cancellationToken = default)
    {
        if (await db.Salons.AnyAsync(x => x.Slug == "royal-barbers", cancellationToken))
            return;

        var salon = new Salon
        {
            Name = "Royal Barbers",
            Slug = "royal-barbers",
            Phone = "+923001234567",
            Email = "owner@royalbarbers.local",
            TimeZone = "Asia/Karachi",
            CurrencyCode = "PKR",
            Settings = new SalonSettings
            {
                BookingIntervalMinutes = 30,
                MaxAdvanceDays = 30,
                AllowSameDayBooking = true,
                AutoConfirmBookings = true,
                CancellationHours = 2,
                LateArrivalMinutes = 10
            }
        };

        foreach (var day in Enum.GetValues<DayOfWeek>())
        {
            salon.BusinessHours.Add(new BusinessHour
            {
                DayOfWeek = day,
                IsOpen = true,
                OpenTime = new TimeOnly(8, 0),
                CloseTime = new TimeOnly(21, 0)
            });
        }

        var services = new[]
        {
            new Service { Salon = salon, Name = "Haircut", DurationMinutes = 40, OriginalPrice = 600, HomeServiceEnabled = true, HomeOriginalPrice = 900, ImageUrl = "assets/images/services/haircut.webp" },
            new Service { Salon = salon, Name = "Beard Trim", DurationMinutes = 25, OriginalPrice = 400, HomeServiceEnabled = true, HomeOriginalPrice = 650, ImageUrl = "assets/images/services/beard-trim.webp" },
            new Service { Salon = salon, Name = "Hair + Beard + Free Hair Massage", DurationMinutes = 60, OriginalPrice = 1100, HomeServiceEnabled = true, HomeOriginalPrice = 1500, ImageUrl = "assets/images/services/hair-beard-massage.webp" },
            new Service { Salon = salon, Name = "Kids Haircut", DurationMinutes = 30, OriginalPrice = 500, HomeServiceEnabled = true, HomeOriginalPrice = 800, ImageUrl = "assets/images/services/kids-haircut.webp" },
            new Service { Salon = salon, Name = "Hair Wash", DurationMinutes = 20, OriginalPrice = 300, HomeServiceEnabled = true, HomeOriginalPrice = 500, ImageUrl = "assets/images/services/hair-wash.webp" },
            new Service { Salon = salon, Name = "Hair Coloring", DurationMinutes = 75, OriginalPrice = 1800, HomeServiceEnabled = true, HomeOriginalPrice = 2300, ImageUrl = "assets/images/services/hair-color.webp" },
            new Service { Salon = salon, Name = "6 Step Face Massage", DurationMinutes = 45, OriginalPrice = 1200, HomeServiceEnabled = true, HomeOriginalPrice = 1600, ImageUrl = "assets/images/services/face-massage.webp" }
        };

        var falak = new Barber
        {
            Salon = salon,
            FullName = "Falak Shair",
            Phone = "+923001111111",
            Rating = 4.9m,
            ExperienceYears = 8,
            ImageUrl = "assets/images/barber-placeholder.svg"
        };

        var second = new Barber
        {
            Salon = salon,
            FullName = "Second Barber",
            Phone = "+923002222222",
            Rating = 4.7m,
            ExperienceYears = 5,
            ImageUrl = "assets/images/barber-placeholder.svg"
        };

        foreach (var day in Enum.GetValues<DayOfWeek>())
        {
            falak.WorkingHours.Add(new BarberWorkingHour
            {
                DayOfWeek = day,
                IsWorking = true,
                StartTime = new TimeOnly(8, 0),
                EndTime = new TimeOnly(21, 0)
            });
            second.WorkingHours.Add(new BarberWorkingHour
            {
                DayOfWeek = day,
                IsWorking = true,
                StartTime = new TimeOnly(8, 0),
                EndTime = new TimeOnly(21, 0)
            });
        }

        foreach (var service in services)
        {
            falak.Services.Add(new BarberService { Service = service });
            second.Services.Add(new BarberService { Service = service });
        }

        db.Salons.Add(salon);
        db.Services.AddRange(services);
        db.Barbers.AddRange(falak, second);

        await db.SaveChangesAsync(cancellationToken);
    }
}

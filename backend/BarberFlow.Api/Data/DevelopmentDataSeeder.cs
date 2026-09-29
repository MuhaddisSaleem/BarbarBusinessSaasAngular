using BarberFlow.Api.Domain.Entities;
using BarberFlow.Api.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace BarberFlow.Api.Data;

public static class DevelopmentDataSeeder
{
    public static async Task SeedAsync(
        BarberFlowDbContext db,
        IConfiguration configuration,
        CancellationToken cancellationToken = default)
    {
        var slug = configuration["DevelopmentData:SalonSlug"] ?? "royal-barbers";

        if (await db.Salons.AnyAsync(x => x.Slug == slug, cancellationToken))
            return;

        var salon = new Salon
        {
            Name = "Royal Barbers",
            Slug = slug,
            Phone = "+92 300 1234567",
            Email = "owner@royalbarbers.local",
            TimeZone = "Asia/Karachi",
            CurrencyCode = "PKR",
            IsActive = true,
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

        salon.Users.Add(new SalonUser
        {
            FullName = "Development Owner",
            Email = "owner@royalbarbers.local",
            Role = SalonUserRole.Owner,
            IsActive = true
        });

        var haircut = Service("Haircut", 40, 600, 900);
        var beard = Service("Beard", 40, 600, 900);
        var beardTrim = Service("Beard Trim", 25, 400, 600);
        var hairBeard = Service("Hair + Beard + Free Hair Massage", 60, 1000, 1400);
        var kids = Service("Kids Haircut", 35, 500, 750);
        var wash = Service("Hair Wash", 20, 300, 450);
        var coloring = Service("Hair Coloring", 60, 1500, 2000);
        var faceMassage = Service("6 Step Face Massage", 45, 1200, 1600);

        salon.Services.Add(haircut);
        salon.Services.Add(beard);
        salon.Services.Add(beardTrim);
        salon.Services.Add(hairBeard);
        salon.Services.Add(kids);
        salon.Services.Add(wash);
        salon.Services.Add(coloring);
        salon.Services.Add(faceMassage);

        var falak = Barber("Falak Shair", "+92 300 1234567", 5m);
        var second = Barber("Second Barber", "+92 301 1234567", 4m);

        Link(falak, haircut, beard, beardTrim, hairBeard, kids, wash, coloring, faceMassage);
        Link(second, haircut, beardTrim, kids, wash);

        AddWorkingWeek(falak);
        AddWorkingWeek(second);

        salon.Barbers.Add(falak);
        salon.Barbers.Add(second);

        db.Salons.Add(salon);
        await db.SaveChangesAsync(cancellationToken);
    }

    private static Service Service(string name, int duration, decimal salonPrice, decimal homePrice)
    {
        return new Service
        {
            Name = name,
            DurationMinutes = duration,
            OriginalPrice = salonPrice,
            DiscountPrice = null,
            HomeServiceEnabled = true,
            HomeOriginalPrice = homePrice,
            HomeDiscountPrice = null,
            ImageUrl = "assets/images/service-placeholder.svg",
            IsActive = true
        };
    }

    private static Barber Barber(string name, string phone, decimal rating)
    {
        return new Barber
        {
            FullName = name,
            Phone = phone,
            Rating = rating,
            ExperienceYears = 5,
            ImageUrl = "assets/images/barber-placeholder.svg",
            IsActive = true
        };
    }

    private static void Link(Barber barber, params Service[] services)
    {
        foreach (var service in services)
        {
            barber.Services.Add(new BarberService
            {
                Barber = barber,
                Service = service
            });
        }
    }

    private static void AddWorkingWeek(Barber barber)
    {
        foreach (var day in Enum.GetValues<DayOfWeek>())
        {
            barber.WorkingHours.Add(new BarberWorkingHour
            {
                DayOfWeek = day,
                IsWorking = true,
                StartTime = new TimeOnly(9, 0),
                EndTime = new TimeOnly(21, 0)
            });
        }
    }
}

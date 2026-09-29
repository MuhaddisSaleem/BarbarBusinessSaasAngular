# BarberFlow — Salon & Barber Management SaaS

Angular frontend plus an ASP.NET Core / SQL Server backend foundation for the BarberFlow SaaS project.

## Frontend

The Angular application currently contains the approved customer booking flow, admin booking management, walk-ins, barbers, services, customers, settings, calendar and reporting UI.

Run it locally:

```bash
npm install
npm start
```

Open `http://localhost:4200`.

## Backend foundation

The backend lives in:

- `backend/BarberFlow.Api`
- `docs/database-architecture.md`

The first backend phase includes:

- ASP.NET Core Web API on .NET 10
- Entity Framework Core
- SQL Server provider
- Multi-salon database model
- salon users and roles
- barbers, specialties and schedules
- services and prices
- customers
- bookings and booking-service snapshots
- business hours, leave and schedule overrides
- Docker setup for API + SQL Server
- backend CI validation

### Start SQL Server

Copy the environment example and set a strong local password:

```bash
cp .env.example .env
docker compose up -d sqlserver
```

### Configure the API connection

Set the connection string before starting the API.

macOS/Linux:

```bash
export ConnectionStrings__DefaultConnection="Server=localhost,1433;Database=BarberFlow;User Id=sa;Password=YOUR_PASSWORD;Encrypt=False;TrustServerCertificate=True"
```

PowerShell:

```powershell
$env:ConnectionStrings__DefaultConnection="Server=localhost,1433;Database=BarberFlow;User Id=sa;Password=YOUR_PASSWORD;Encrypt=False;TrustServerCertificate=True"
```

Create/update the local database and then run the API:

```bash
dotnet tool restore
dotnet restore backend/BarberFlow.Api/BarberFlow.Api.csproj
dotnet ef database update --project backend/BarberFlow.Api --startup-project backend/BarberFlow.Api
dotnet run --project backend/BarberFlow.Api
```

API HTTP URL: `http://localhost:5080`

Useful endpoints:

- `GET /health`
- `GET /api/system/info`
- `GET /api/system/database`

## Database model

See `docs/database-architecture.md` for the schema, relationships, tenant boundaries and the mapping from the current Angular/localStorage model to SQL Server.

## Booking API integration

Bookings are the first Angular module being moved from browser persistence to SQL Server.

When the ASP.NET API is available:

- Angular loads bookings from `GET /api/bookings`;
- the booking service removes the old booking localStorage key;
- online, admin and walk-in booking creates are sent to the API;
- status updates, barber reassignment, rescheduling, cancellation and custom home-service pricing are sent to the API;
- the API revalidates salon hours, barber working hours, leave, specialties and overlapping appointments before writing to SQL Server.

Barbers, services and settings are still using their existing frontend stores during this migration stage. Development seed data creates matching catalog records in SQL Server so the Booking API can validate the current demo flow.

### Booking endpoints

```text
GET    /api/bookings
GET    /api/bookings/{id}
POST   /api/bookings/online
POST   /api/bookings/walk-in
POST   /api/bookings/admin
POST   /api/bookings/availability
PATCH  /api/bookings/{id}/status
PATCH  /api/bookings/{id}/barber
PATCH  /api/bookings/{id}/schedule
PATCH  /api/bookings/{id}/special-service-price
DELETE /api/bookings/{id}
```

The next migration step after bookings is to move **Services, Barbers and Settings** to APIs so the entire availability catalog comes from SQL Server instead of browser storage.

The approved frontend behavior remains the functional specification while this migration happens.

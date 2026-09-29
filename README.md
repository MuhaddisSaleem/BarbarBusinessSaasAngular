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

Then run:

```bash
dotnet tool restore
dotnet restore backend/BarberFlow.Api/BarberFlow.Api.csproj
dotnet run --project backend/BarberFlow.Api
```

API HTTP URL: `http://localhost:5080`

Useful endpoints:

- `GET /health`
- `GET /api/system/info`
- `GET /api/system/database`

## Database model

See `docs/database-architecture.md` for the schema, relationships, tenant boundaries and the mapping from the current Angular/localStorage model to SQL Server.

## Current migration plan

The Angular UI remains unchanged while backend persistence is introduced module by module.

The next backend module is **Bookings**:

1. create the initial EF Core migration;
2. seed a development salon/services/barbers dataset;
3. expose availability and booking APIs;
4. move overlap validation into a database-backed transaction;
5. replace Angular booking localStorage persistence with API calls.

The approved frontend behavior remains the functional specification while this migration happens.

# BarberFlow Booking — Angular MVP

Angular 17 frontend for the Royal Barbers / Barber & Salon Management SaaS project.

## Current features

- Responsive premium dark/gold booking UI
- Service selection
- Barber selection
- Any Barber assignment
- Dynamic 7-day date selector
- Available time slot calculation
- Appointment overlap prevention based on service duration
- Customer name, phone and notes
- Live booking summary
- Booking confirmation modal

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:4200`.

## Main files

- `src/app/booking/booking.component.ts`
- `src/app/booking/booking.component.html`
- `src/app/booking/booking.component.scss`

## Current stage

This is the frontend MVP. Bookings are persisted in localStorage in this browser. The owner dashboard and appointments/calendar use the same booking service. ASP.NET Core Web API, SQL Server persistence, authentication/tenant isolation, WhatsApp delivery and payments remain future integration work. Browser data is not shared across devices or users.

The SVG images currently committed are placeholders so the repository is self-contained. They can be replaced with final barber photography without changing the booking logic.

## Phase 3 — Appointments management

Open `/admin/bookings` for today's appointments, all/history tabs, search, barber/service/date/status filters and ten-row pagination. Calendar opens `/admin/calendar` with daily and weekly views. Both desktop tables and mobile cards open the same details drawer.

- Statuses: Pending → Confirmed → In Progress → Completed. Confirmed may also be completed directly. Open appointments can be cancelled; Pending/Confirmed may be marked No Show only after the configured grace period. Closed appointments cannot reopen, reschedule or be repriced. Future appointments cannot start or complete early.
- Reschedule/reassign validates and saves the final barber, date and time together, including service eligibility, shifts, time off, business hours and overlaps. Failed browser writes restore the previous booking.
- Add Walk-In schedules today (including the current minute) even when online same-day booking is disabled. It still checks business hours, barber availability, service and conflicts. Ordinary New Booking follows the configured booking window.
- Cancelled and No Show release capacity and are excluded from booked-value calculations. Completed revenue still counts only Completed appointments. Calendar history retains all statuses; its status filter applies to daily and weekly views.
- Existing Online/Admin records remain compatible; Walk-in is stored as its own source. The UI uses the browser's local date/time, consistent with the existing booking flow.

### Verify

```bash
npm install
npm run test:appointments
npm run build
```

Regression tests run the real service/component methods with a fixed clock and storage/dependency doubles. The production build checks Angular templates and dependency injection. GitHub Actions runs both for pull requests into main.

Manual review: create a walk-in, try an overlapping appointment, reschedule it to another barber/time, progress a due appointment to Completed, mark a late appointment No Show, refresh to confirm persistence, and check the same records in calendar/dashboard/reports at desktop and mobile widths.

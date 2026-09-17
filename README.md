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

This is the frontend MVP. Bookings are stored in memory and disappear after refresh. The next phases are the owner dashboard, ASP.NET Core Web API, SQL Server persistence, WhatsApp notifications and payments.

The SVG images currently committed are placeholders so the repository is self-contained. They can be replaced with final barber photography without changing the booking logic.

# Walk-in customer booking

The working booking version approved on 29 September 2026 is saved at
`checkpoint/booking-approved-2026-09-29`, commit
`f3d1d012f7e8551c29ca098ccd2cb63a7c2ad973`.
Walk-in development is isolated on `codex/walk-in-booking`.

CI checks that public booking, barber management, and all original regression
and browser tests remain identical to the checkpoint. This is a regression gate,
not GitHub branch protection. Main and the approved compatibility branch are not
changed by this feature.

## Staff workflow

1. Open Admin → Bookings → Walk-in Customer.
2. Enter a customer name. Pakistan mobile number and notes are optional.
3. Choose one or more active services; the displayed price includes configured
   discounts and the duration is their combined duration.
4. Choose the earliest available time shown for an eligible barber.
5. Create the booking. It opens in the existing details drawer as Confirmed,
   Salon, source Walk-in. Mark Completed after service using the existing action.

## Rules

- A walk-in is for today in the browser's local time, at minute precision.
- Staff may book now or the next real gap, without rounding to the online slot grid.
- Online same-day and advance booking restrictions do not prevent counter
  walk-ins. Regular admin/public booking and rescheduling policies are unchanged.
- Salon opening hours, barber shifts, active status, leave, service specialties,
  total duration and non-cancelled appointment conflicts still apply.
- Availability and service prices are checked again before saving. Changed prices
  require review; failed saves keep entered details and require a fresh slot.
- A storage change from another tab refreshes choices and clears the old selection.
- Blank phone numbers are allowed only by this new creation flow. Unrelated
  unnamed-phone visits remain separate customer records, keyed by booking ID.
  Visits with a phone number retain existing customer grouping.
- Existing statuses, revenue calculations, public booking, barber fields, and
  photo validation are unchanged. Confirmed does not mean paid or completed.

## Verification

- `npm run test:qa`: 60 existing regression tests, unchanged.
- `npm run test:walk-in`: 24 walk-in regression tests.
- `npm run build`: production Angular build.
- `npm run test:ui`: 32 existing desktop/mobile browser scenarios, unchanged.
- `npm run test:walk-in:ui`: 10 additional scenarios across desktop and mobile,
  using Asia/Karachi time, including cross-tab availability changes.

Browser tests require Playwright and Chromium and run against the production build.
GitHub Actions installs these and retains screenshots.

## Existing storage limitation

Bookings use the app's existing browser localStorage. The new flow refreshes
before saving and responds to other tabs, but this is not a shared backend or a
transactional multi-device reservation system. Server-side conflict enforcement
would be needed for independent reception devices.

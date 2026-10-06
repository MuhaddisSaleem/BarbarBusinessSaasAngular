# Final QA bug-sheet resolution

Reviewed 6 October 2026 against `the_trim_town_final` at `086d027`.
Fix branch: `fix/final-qa-bug-sheet`.
Source: the supplied `The-Trim-Town-QA-Bug-Sheet(4).xlsx` (TT-01–TT-12).

On 6 October 2026, the user explicitly authorized pushing these fixes to `the_trim_town_final`. Full browser and SQL Server validation remain outstanding; the push is not a claim of release readiness.

| ID | State when reviewed | Action and current validation |
| --- | --- | --- |
| TT-01 | Already fixed | Production Angular build passes. Existing bundle/style warnings remain. |
| TT-02 | Already fixed | Retained server-owned prices and duration. Backend scenarios confirm submitted price, duration and public custom price cannot override catalogue values. |
| TT-03 | Already fixed, with an adjacent gap | Retained category, home eligibility and address checks. Fixed mixed standard/custom availability to include the extra custom-service hour. Backend scenarios pass. |
| TT-04 | Open | Replaced browser-only media persistence with shared SQL-backed branding endpoints. Public reads, authenticated salon-scoped writes/deletes, 2 MB limit and media-signature checks. Frontend and backend component checks pass; production migration and cross-device browser test remain. |
| TT-05 | Open | Booking deep links subscribe to route changes and wait for delayed booking data. Subscriptions are cleaned up; background refresh does not reopen a dismissed drawer. Regression passes. |
| TT-06 | Open | A committed POST triggers success independently of the subsequent refresh. Refresh errors generate a separate warning instead of prompting a duplicate save. Authenticated and public regression cases pass. |
| TT-07 | Open | Walk-in creation has an in-flight guard and disabled submit button. Errors unlock retry; success closes the modal. Regression cases pass. |
| TT-08 | Open | Requests, availability and responses carry a structured `serviceNames` array. Walk-in eligibility and booking/service filters preserve embedded commas. Legacy string-only requests retain compatibility. Frontend and backend regressions pass. |
| TT-09 | Open | JWTs include a keyed credential stamp. Every authenticated request verifies the active user and current stamp; password changes/resets invalidate prior tokens. Changing a password signs out the current UI. Actual in-process HTTP login, password change/reset and old-token replay tests pass. Tests also cover failed password changes, reset-code reuse and inactive users. |
| TT-10 | Open | Scheduling, walk-ins, calendar, relevant admin date filters, reporting date defaults and public opening status use the configured salon timezone. Added rollover, daylight-saving offset and invalid-zone fallback cases. Frontend checks pass; browser timezone matrix remains. |
| TT-11 | Partially fixed by TT-02 | Home catalogue snapshots were already corrected. New custom bookings and repricing now persist a custom service line and reconcile its amount with the booking total. Backend scenarios pass. Historical records created before the fixes still need an audit; their financial snapshots were not bulk rewritten. |
| TT-12 | Open | Updated multi-select fixtures, category data, timer stubs, observable route/data behavior and the reviewed file-lock baseline without removing protected files or behavioral assertions. Updated browser smoke selectors, category/branding mocks and salon-time clock. Automated frontend suite passes; browser smoke execution remains blocked. |

## Validation performed

- `npm run build`: passed; Angular templates and TypeScript compiled.
- `npm run test:qa`: **86 passed, 0 failed** (73 existing checks plus 13 focused cases).
- `dotnet run --project backend/BarberFlow.Qa`: **40 checks passed** using isolated SQLite scenarios and the real ASP.NET application through an in-process HTTP test server with EF InMemory for authentication. Covers booking operations, report reconciliation, branding persistence/authorization, password change/reset and token replay. SQLite test schema translates SQL Server's `nvarchar(max)` declaration to `TEXT`; it does not replace SQL Server validation.
- Backend project compiled with .NET SDK 10.0.401, without compiler warnings/errors.
- EF `migrations has-pending-model-changes`: no pending model differences.
- SQL Server script generated for `AddSharedBranding`; it only creates the media table, foreign key and migration-history entry. It has not been applied to a real SQL Server database.
- `git diff --check` and `node --check tests/ui-smoke.cjs`: passed.
- `npm run test:ui`: blocked because the configured Playwright Chromium executable is absent. Follow-up installation of the matching Playwright browser failed repeatedly with incomplete/invalid ZIP downloads. The earlier browser audit also encountered an environment socket-permission failure. Browser scenarios are not counted as passing.

## Required before final release sign-off

1. Apply and verify the branding migration in a disposable SQL Server test environment.
2. Run the desktop/mobile browser suite and the real API journeys: online/group/home bookings, repeated submissions, notifications, branding across clients, password reset with actual test email delivery, and salon/browser timezone differences. Password-reset confirmation and old-token replay already pass in the in-process HTTP tests.
3. Audit historical service-line totals from bookings created before TT-02/TT-11 fixes. Run the read-only `backend/qa/audit-historical-service-totals.sql` to identify snapshot discrepancies. Determine any data repair from the actual historical records; the audit script has been prepared but not executed against SQL Server.

## Rollout notes

- Existing browser-only logo/hero assets remain in IndexedDB but are no longer treated as published branding. Re-upload them through Settings after migration to publish them for all visitors.
- Accepted server media: PNG, JPEG, GIF, WebP, and hero MP4/WebM. SVG is no longer accepted; the upload UI now lists the supported types.
- Tokens issued before the credential-stamp change will require a new login.
- Build warnings remain for initial bundle/style sizes, the `/assets/css/mobile-responsive-fix.css` lookup during build, and a Bootstrap selector. The production build succeeds; rendered browser verification is outstanding.
- The protected-file manifest retains all 45 files. Its metadata records the authorized fixes and refreshed files. This baseline check supplements the behavior tests; it is not evidence of full-site correctness.

## Continuation validation

- Backend solution `backend/BarberFlow.slnx` groups the API and QA runner.
- `dotnet run --project backend/BarberFlow.Qa` now runs 40 checks. SMTP is not contacted: the HTTP reset scenario seeds a delivered verification code, then invokes the real reset endpoint and replays the old bearer token through authentication middleware.
- Actual report-service output is checked against booking totals, including mixed standard/custom bookings and custom-only bookings.
- No SQL Server instance or Docker runtime is available in this workspace. A running test environment and historical dataset are needed to complete the remaining gates.
- The earlier validation continuation made no commit or push. The user subsequently authorized pushing the fixes to `the_trim_town_final`.

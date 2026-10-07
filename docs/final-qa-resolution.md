# Final QA bug-sheet resolution

Initial review: 6 October 2026 at `086d027`.
Final automated QA continuation: 7 October 2026 against `the_trim_town_final` at `998d036`.
Fixes originally prepared on `fix/final-qa-bug-sheet`, then pushed to the client branch with authorization.
Source: the supplied `The-Trim-Town-QA-Bug-Sheet(4).xlsx` (TT-01–TT-12).

On 6 October 2026, the user explicitly authorized pushing these fixes to `the_trim_town_final`. SQL Server CI subsequently passed on 7 October. Browser QA completed 41 passing scenarios across desktop/mobile and identified an inaccessible public group-booking journey on both widths. The push is not a claim of release readiness.

| ID | State when reviewed | Action and current validation |
| --- | --- | --- |
| TT-01 | Already fixed | Production Angular build passes. Existing bundle/style warnings remain. |
| TT-02 | Already fixed | Retained server-owned prices and duration. Backend scenarios confirm submitted price, duration and public custom price cannot override catalogue values. |
| TT-03 | Already fixed, with an adjacent gap | Retained category, home eligibility and address checks. Fixed mixed standard/custom availability to include the extra custom-service hour. Backend scenarios pass. |
| TT-04 | **Open → Fixed** | Shared SQL-backed branding is verified end-to-end at the API/storage boundary. Real SQL Server CI applies the migration, uploads logo + hero as the authenticated salon admin, re-reads both from an independent anonymous client, byte-compares the persisted media, rejects unauthorized deletion, then deletes and confirms 404. Fresh-browser frontend consumption is also covered by the existing TT-04 regression. **Fixed and verified in Backend CI run 37579117832.** |
| TT-05 | **Open → Fixed** | Booking deep links now have both component-level and focused Chromium coverage. The browser regression gates all initial `/api/bookings` responses to prove the drawer waits for delayed data, switches `?booking=` within the reused route, then closes the drawer, performs a real walk-in mutation/booking refresh, and confirms the dismissed drawer does not reopen. **Focused TT-05 browser step passed in run 37579878914 at commit `99d1142`.** |
| TT-06 | **Open → Fixed** | A committed booking POST now remains successful even when the follow-up list/availability refresh fails. Existing unit regressions cover authenticated and public paths; the focused Chromium gate verifies authenticated walk-ins on desktop/mobile and a public online booking on desktop, forces the post-save refresh to return 503, confirms exactly one POST/one committed booking, keeps the success UI, and does not present the save as failed. **TT-06 browser step passed in run 37580939739 at commit `055d2ea`.** |
| TT-07 | **Open → Fixed** | Walk-in creation uses the `creatingBooking` in-flight guard and disabled submit state. Focused Chromium coverage verifies one request during rapid repeated submit, keeps the modal open while saving, re-enables retry after a failed request, and closes after one successful retry. **Validated in Booking regression QA run `37581703413` at commit `82908e7`.** |
| TT-08 | **Open → Fixed** | Comma-containing catalogue names are preserved as one service across walk-in selection, `serviceNames` request payloads, booking persistence/responses, availability/filter logic, and legacy string-only booking fallbacks. Exact catalogue-name matches are resolved before legacy comma splitting. Unit/build checks pass; focused desktop/mobile Chromium validation passed in Booking regression QA run `37583273900`, and the real SQL Server/API persistence check passed in Backend CI run `37583273955` at commit `8461675`. |
| TT-09 | **Open → Fixed** | JWTs include a keyed credential stamp and authenticated requests revalidate the active user/current stamp. Password changes and resets invalidate prior tokens; failed changes keep the valid session. Successful password change clears browser auth state and redirects to `/admin/login`. `backend/BarberFlow.Qa` is now executed by Backend CI, covering login, password change/reset, old-token replay, reset-code reuse, previous-password rejection, and inactive-user rejection. Focused desktop/mobile Chromium TT-09 passed in Booking regression QA run `37584905463`; Backend CI run `37584905528` passed on commit `a4387ee`. |
| TT-10 | **Open → Fixed** | Scheduling, walk-ins, admin calendar/date filters, report defaults and public booking dates use the configured salon timezone rather than the browser timezone. Unit coverage includes Asia/Karachi rollover, New York DST/standard offsets and invalid-zone fallback. Focused Chromium runs with browsers in Honolulu and New York at a UTC instant where the salon has already rolled into the next day; both widths correctly use the Asia/Karachi date. **TT-10 browser step passed in Booking regression QA run `37586241141`.** |
| TT-11 | **Partial → Fixed** | New bookings/repricing persist reconciled service snapshots. Historical bookings are now reconciled safely at report-read time without bulk rewriting or guessing past catalogue prices: missing/outdated custom-service lines use the booking's own stored `SpecialServiceAmount`, and any remaining unexplained difference is surfaced as `Historical adjustment` so service values always reconcile to the immutable booking total. Seeded stale historical data, backend QA, build/migrations and SQL-backed API smoke all pass in Backend CI run `37586455674`. |
| TT-12 | Open | Updated multi-select fixtures, category data, timer stubs, observable route/data behavior and the reviewed file-lock baseline without removing protected files or behavioral assertions. Updated browser smoke selectors, category/branding/reset mocks and salon-time clock. Automated frontend suite passes; 41 browser scenarios pass; group-booking availability remains an open finding. |

## Validation performed

- `npm run build`: passed; Angular templates and TypeScript compiled.
- `npm run test:qa`: **86 passed, 0 failed** (73 existing checks plus 13 focused cases).
- `dotnet run --project backend/BarberFlow.Qa`: **40 checks passed** using isolated SQLite scenarios and the real ASP.NET application through an in-process HTTP test server with EF InMemory for authentication. Covers booking operations, report reconciliation, branding persistence/authorization, password change/reset and token replay. SQLite test schema translates SQL Server's `nvarchar(max)` declaration to `TEXT`; it does not replace SQL Server validation.
- Backend project compiled with .NET SDK 10.0.401, without compiler warnings/errors.
- EF `migrations has-pending-model-changes`: no pending model differences.
- SQL Server script generated for `AddSharedBranding`; it only creates the media table, foreign key and migration-history entry. The subsequent Backend CI run applied migrations against its disposable SQL Server service and passed its API smoke checks.
- TT-04 closure: SQL Server-backed shared branding persistence passed in Backend CI run `37579117832` at code commit `72d2273`; logo and hero survived an independent anonymous re-read with exact byte equality, and authenticated deletion was verified.
- TT-05 closure: the focused Chromium deep-link regression passed at both 1440px and 390px in Booking regression QA run `37579878914` at code commit `99d1142`. The existing `npm run test:qa` TT-05 component regression also passes.
- TT-06 closure: forced post-save refresh failures no longer turn committed bookings into apparent save failures. Unit tests pass for authenticated/public cases, and the focused Chromium gate passed in Booking regression QA run `37580939739` at code commit `055d2ea`.
- `git diff --check` and `node --check tests/ui-smoke.cjs`: passed.
- `npm run test:ui` via GitHub Actions: **41 scenarios passed** across 1440px desktop and 390px mobile. Overall job correctly fails because public group controls are hidden at both widths. Online/home bookings, walk-ins, dashboard/report totals, nine admin routes, barber CRUD, availability refresh/conflicts/cancellation and Settings save/reload/reset pass. Browser API responses are mocked; SQL-backed API CI is separate, not a full browser-to-SQL end-to-end test.

## Required before final release sign-off

1. Completed for TT-04: disposable SQL Server migration/startup plus shared logo/hero persistence passed. The TT-04-specific real SQL validation is run `37579117832`. Production migration/re-upload remains a deployment step, not an open TT-04 code defect.
2. Run the desktop/mobile browser suite and the real API journeys: online/group/home bookings, repeated submissions, notifications, branding across clients, password reset with actual test email delivery, and salon/browser timezone differences. Password-reset confirmation and old-token replay already pass in the in-process HTTP tests.
3. Audit historical service-line totals from bookings created before TT-02/TT-11 fixes. Run the read-only `backend/qa/audit-historical-service-totals.sql` to identify snapshot discrepancies. Determine any data repair from the actual historical records; the audit script has been prepared but not executed against SQL Server.

## Rollout notes

- Existing browser-only logo/hero assets remain in IndexedDB but are no longer treated as published branding. Re-upload them through Settings after migration to publish them for all visitors.
- Accepted server media: PNG, JPEG, GIF, WebP, and hero MP4/WebM. SVG is no longer accepted; the upload UI now lists the supported types.
- Tokens issued before the credential-stamp change will require a new login.
- Build warnings remain for initial bundle/style sizes, the `/assets/css/mobile-responsive-fix.css` lookup during build, and a Bootstrap selector. The production build succeeds; desktop/mobile browser checks ran as described above.
- The protected-file manifest retains all 45 files. Its metadata records the authorized fixes and refreshed files. This baseline check supplements the behavior tests; it is not evidence of full-site correctness.

## Continuation validation

- Backend solution `backend/BarberFlow.slnx` groups the API and QA runner.
- `dotnet run --project backend/BarberFlow.Qa` now runs 40 checks. SMTP is not contacted: the HTTP reset scenario seeds a delivered verification code, then invokes the real reset endpoint and replays the old bearer token through authentication middleware.
- Actual report-service output is checked against booking totals, including mixed standard/custom bookings and custom-only bookings.
- GitHub Actions supplied the disposable SQL Server environment. Actual client historical data and configured messaging services are still needed for the handover checks.
- Fixes and test-harness updates have been pushed to `the_trim_town_final` under the user’s authorization; no production deployment was performed.

## Final QA continuation — 7 October 2026

- **TT-10 closed on 7 October 2026:** focused browser timezone matrix proved salon wall-time/date behavior is independent of the device timezone; run `37586241141` passed the TT-10 step.
- **TT-11 closed on 7 October 2026:** historical report totals now reconcile non-destructively using stored booking snapshots, with explicit historical adjustments instead of present-day price guesses; Backend CI run `37586455674` passed.

- **TT-09 closed on 7 October 2026:** credential-stamped sessions are invalidated by password change/reset, successful UI password changes sign out immediately, and both focused Chromium plus in-process HTTP auth replay coverage are now enforced in CI.

- **TT-08 closed on 7 October 2026:** comma-containing catalogue services stay a single service in current and legacy paths; focused Chromium run `37583273900` and SQL-backed Backend CI run `37583273955` passed on commit `8461675`.

- **TT-04 closed on 7 October 2026:** real SQL Server persistence and independent-client reads passed in Backend CI run `37579117832` at code commit `72d2273`.
- **TT-05 closed on 7 October 2026:** delayed booking data, route reuse and dismissed-drawer refresh behavior passed the dedicated desktop/mobile Chromium gate in run `37579878914` at commit `99d1142`.
- **TT-06 closed on 7 October 2026:** committed admin/public bookings remain successful through forced refresh failure without duplicate POSTs; focused browser validation passed in run `37580939739` at commit `055d2ea`.

- Backend CI passed against SQL Server: https://github.com/MuhaddisSaleem/BarbarBusinessSaasAngular/actions/runs/37577089199 .
- Chromium browser execution is now available through draft PR #9. Earlier local installation limitations no longer prevent CI browser testing.
- Corrected stale smoke-test selectors for scroll reveals, the shared footer, and the walk-in overlay. The final run continued past the group finding and completed both responsive journeys.
- **OPEN — public group booking inaccessible:** `booking.component.html` hides the Just Me / Me + Someone Else action stage with `d-none`; a separate service-search stage is shown. This existed before the QA fixes. The group journey cannot be signed off. The harness reports the failure and continues other checks; it still fails overall. Clarify whether group booking is included in the client's agreed scope before restoring a deliberately hidden interface.
- Settings reset now has a branding-delete API fixture and an explicit success assertion. Mocked browser API success is not evidence of real email/SMS delivery or cross-device persistence.
- No deployment or PR merge was performed. The original bug sheet is not marked fully done while browser findings and real-environment handover checks remain.

### Final run evidence

- Tested commit: `998d036a833d0578f824cb5cc180829fc461d55f`.
- Browser/frontend/build run: https://github.com/MuhaddisSaleem/BarbarBusinessSaasAngular/actions/runs/37577948811 . Frontend regressions and production build passed; browser log reports 41 passing scenarios and two viewport observations of the same group-booking finding. Screenshots uploaded as artifact `11463656595`.
- Backend SQL Server run: https://github.com/MuhaddisSaleem/BarbarBusinessSaasAngular/actions/runs/37577948792 .
- Visual spot review: captured desktop dashboard and mobile public booking page. This is not a claim of exhaustive visual coverage of every state or browser.
- **Decision: not fully signed off.** Resolve/confirm group-booking scope, verify actual messaging delivery and production branding after migration/re-upload, and audit existing client booking totals before final handover. No client credentials or historical database were available in this run.

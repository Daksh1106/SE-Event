# File Notes
*College Event & Club Hub*

---

### docs/SRS.md
- Contains the Software Requirements Specification migrated directly from the course project specification.
- Defines 16 Functional Requirements (FR-1 to FR-16) and 14 Non-Functional Requirements (NFR-1 to NFR-14).
- Serves as the central reference for requirement traceability, architectural layers, and test cases TC-1 through TC-25.

---

### supabase/schema.sql
- Implements the complete relational schema covering all 7 tables, enums, triggers, and column-level privileges from Section 5.3.
- Enforces strict security rules: RLS enabled on all tables, role immutability trigger (FR-3, NFR-8), and no student insert/update on registrations.
- Configures audit logs for approvals (NFR-14), automatic event status synchronization with approvals, and active/archived club records.

---

### supabase/seed.sql
- Seeds the 16 club names and faculty mentors shown on the official JSS STU clubs page.
- Leaves the mentor blank for clubs where the university page lists none.
- Uses ON CONFLICT resolution for idempotent execution in Supabase SQL editor.

---

### types/database.ts
- Provides TypeScript database types corresponding to all 7 tables and enums in schema.sql.
- Ensures end-to-end type safety across Supabase queries, mutations, and database relationships.
- Guarantees strict compile-time checks without any loose `any` types.

---

### lib/supabase/client.ts
- Configures the browser-side Supabase client using `@supabase/ssr` `createBrowserClient`.
- Uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` environment variables.
- Strictly handles client-side authentication sessions in compliance with NFR-6 and NFR-11.

---

### lib/supabase/server.ts
- Implements the server-side Supabase client using `@supabase/ssr` `createServerClient` and `next/headers` cookies.
- Restricts database operations exclusively to Server Components, Server Actions, and Route Handlers.
- Includes `createAdminClient` with `SUPABASE_SECRET_KEY` reserved solely for administrative server operations (FR-3).

---

### lib/supabase/middleware.ts
- Provides the session refresh logic used by Next.js Edge Middleware to keep auth tokens updated.
- Intercepts requests to refresh expired auth cookies before rendering pages.
- Enforces route guard redirects for protected paths and redirects logged-in users away from auth pages (NFR-8).

---

### proxy.ts
- Next.js 16 "proxy" (the new name for middleware): routes every request through `updateSession`, which refreshes the Supabase session and sends logged-out visitors to `/login` for protected pages.
- The matcher skips static bundles, images and the favicon.
- Role checks are NOT done here; they happen in the layouts and server actions (`requireRole`) and in the database (RLS).

---

### lib/validations/auth.ts
- Defines Zod validation schemas for student signup and user login (FR-1, FR-2).
- Validates the university USN format using regex `^[0-9]{2}[A-Z]{3}[0-9]{2}[A-Z]{2,3}[0-9]{3}$` after uppercase transformation.
- Enforces a minimum 6-character password constraint and optional contact fields (NFR-6, NFR-12).

---

### app/(auth)/actions.ts
- Server Actions for signup, login, and logout executing strictly on the server.
- Uses synthetic email `{usn}@collegehub.org` and creates accounts with the admin API (`email_confirm: true`), because public signups are disabled in Supabase.
- Detects duplicate USNs by Supabase's `email_exists` / `user_already_exists` error codes (TC-2) and gives a clear message for wrong credentials (TC-3).

---

### app/(auth)/signup/signup-form.tsx & app/(auth)/signup/page.tsx
- Client form and server page for student registration (FR-1, TC-1, TC-2, NFR-1, NFR-2).
- Provides instant client-side feedback, uppercase USN styling, and accessible form labels using shadcn/ui.
- Automatically connects with `signupAction` to create the auth account and trigger profile generation.

---

### app/(auth)/login/login-form.tsx & app/(auth)/login/page.tsx
- Client form and server page for student and staff authentication (FR-2, TC-3, NFR-1, NFR-2).
- Accepts USN and password, provides clear error alerts, and redirects to home on successful authentication.
- Accessible and responsive on mobile viewports (360px+) complying with NFR-1.

---

### app/page.tsx
- Server Component home page providing the landing interface and authenticated student/staff dashboard.
- Utilizes React Suspense boundaries for streaming dynamic user session and profile data.
- Provides campus-focused landing content and role-specific quick links (FR-2, FR-6).

---

### lib/datetime.ts
- IST helpers: `parseISTLocal` reads a `datetime-local` value as India time; `formatISTDate/Time/DateTime` display dates in `Asia/Kolkata` (FR-4, FR-6).
- Needed because the server runs in UTC on Vercel, which used to shift stored and displayed event times by 5h30m.
- Used by the event validation, the create-event action and every page that shows event dates.

---

### supabase/migrations/authorization_and_alert_hardening.sql
- Hardening run after `user_roles_and_event_approvals.sql` (applied 2026-11-15): removes `anon`/`PUBLIC` execute rights on `decide_event` and the RLS helper functions, limits students to updating only `alerts.is_read`, and pins one function's `search_path`.
- Safe to re-run; verified by checks (i) and (j) in `scripts/security-check.mjs`.

---

### docs/SECURITY_FINDINGS.md
- Register of known security findings with severity, status and remediation (including the open default staff password, SF-1).
- Updated whenever a finding is opened, accepted or fixed.

---

### scripts/security-check.mjs & scripts/seed-users.mjs
- `security-check.mjs` runs 10 checks as a student / logged-out visitor, re-reads the database with the admin client after each attack, tracks and removes only its own rows, and exits non-zero on any failure or abort.
- `seed-users.mjs` (and `test-tc4-tc6.mjs`) no longer have a default password: `SEED_PASSWORD` must be supplied.

### scripts/reset-staff-passwords.mjs
- Explicitly resets the three seeded staff accounts to separate passwords supplied through environment variables; verifies each auth account and role before making any change and requires confirmation for hosted Supabase.

### scripts/test-tc1-tc3.mjs
- Runs acceptance checks for USN validation, duplicate-account prevention, and password-based sign-in; creates and removes its own temporary test account.

---

## Event discovery and registration (FR-6, FR-7, FR-8)

### supabase/migrations/event_registration_and_waitlist.sql
- Postgres functions `register_for_event`, `cancel_registration`, `get_seat_counts`, `get_my_registrations`. Applied to the live database.
- `register_for_event` locks the event row (`FOR UPDATE`), checks role, deadline and duplicates, counts taken seats and saves the registration as Confirmed or Waitlisted in one transaction, so the seat limit is never exceeded (NFR-5).
- `cancel_registration` cancels and promotes the first waitlisted student, writing an alert for them.

### app/events/page.tsx
- Lists approved upcoming events for active clubs, filterable by club and IST calendar day, with seats left from one `get_seat_counts` call.
- Data flow: browser -> server component -> Supabase (RLS hides pending events) -> HTML.

### app/events/[id]/page.tsx
- Event page: description, venue, fee, contact, deadline, live seats, the student's own registration status and waitlist position.

### app/events/[id]/actions.ts
- Server actions `registerAction` and `cancelRegistrationAction`. They check the role, then call the Postgres functions; every rule lives in the database.

### app/events/[id]/registration-panel.tsx, live-seats.tsx, share-button.tsx
- Client components: Register / Join waitlist / Cancel buttons; a counter that polls the seats API every 8 s; the WhatsApp share button (FR-16).

### app/api/events/[id]/seats/route.ts
- Server route returning live seat counts as JSON, so the browser never talks to the database directly.

### lib/seats.ts, components/seats-badge.tsx
- Wording and colours for "N seats left", "Only 3 seats left", "Full - waitlist open", "Registration closed".

### components/navbar.tsx, components/page-shell.tsx
- Role-aware navigation switches to a phone-friendly Menu dropdown below the large-screen breakpoint. `PageShell` provides the shared page frame and footer.

### lib/supabase/middleware.ts
- Protected prefixes now include /events, /clubs and /certificates (login required).

---

## Waitlist, My Events, and alerts (FR-9, FR-10)

### app/my-events/page.tsx
- Student-only page (`requireRole(['student'])`). One call to `get_my_registrations()` returns every registration with its waitlist position; the page splits them into Registered, Waitlisted and Past.
- Shows a banner for confirmed events starting within 24 hours and the list of alerts, including "a seat opened up and you are now confirmed" written by `cancel_registration`.

### app/my-events/actions.ts
- `markAlertReadAction` and `markAllAlertsReadAction`: the only thing a student can change on an alert is `is_read` (column privilege from `authorization_and_alert_hardening.sql` + RLS).

### app/my-events/cancel-button.tsx
- Client button that confirms, then calls `cancelRegistrationAction`. Cancelling a confirmed seat promotes the first waitlisted student inside the database.

### components/navbar.tsx
- Red badge on "My Events" showing the number of unread alerts.

### lib/datetime.ts
- Added `hasPassed` and `startsWithinHours` (deadline checks and the 24-hour banner).

---

## Coordinator tools, attendance, PDF export, and certificates (FR-11 to FR-14)

### supabase/migrations/coordinator_attendance_and_certificates.sql
- Postgres functions `get_event_registrations`, `mark_attendance`, `record_certificate`, plus the private `certificates` storage bucket and its policy. Applied to the live database.
- `get_event_registrations` answers only for the coordinator of the event's club (or an admin); coordinators never get direct access to student profiles (NFR-8).
- `record_certificate` refuses anyone who did not attend, so a certificate row cannot exist for a non-attendee. Direct writes to the `certificates` table were removed.
- Storage policy: a student can only read files inside the folder named after their own user id (NFR-7).

### app/coordinator/events/[id]/page.tsx
- Manage one event: counts, attendance checklist, certificate button, waitlist in order. Opening another club's event shows "Access denied" and no student data (TC-17).

### app/coordinator/events/[id]/actions.ts
- `saveAttendanceAction` calls `mark_attendance`. `generateCertificatesAction` builds one PDF per attended student, uploads it to storage as `<student id>/<event id>.pdf`, then calls `record_certificate`. Students are processed 8 at a time.

### app/coordinator/events/[id]/attendance-form.tsx, certificate-button.tsx
- Client components: the tick list with Select all / Clear all / Save, and the Generate certificates button. Students who already have a certificate cannot be un-ticked.

### app/coordinator/events/[id]/pdf/route.ts
- Server route that returns the confirmed students as a PDF. Authorisation is done by `get_event_registrations`.

### lib/pdf/registrations-pdf.ts, certificate-pdf.ts, text.ts
- Built with `pdf-lib` and its built-in fonts (no network needed). The list repeats its header on every page and shows page numbers. Each club gets its own certificate colour theme; long names shrink and long event titles wrap to two lines. Characters outside Latin-1 (for example Kannada) print as "?".

### app/certificates/page.tsx and app/certificates/[eventId]/download/route.ts
- Student certificate list and download. Two independent checks protect a file: RLS on the `certificates` table and the storage policy, so changing the link never reveals another student's certificate (TC-20).

### app/coordinator/page.tsx
- Approved events now show "N / limit taken" and a "Manage registrations & attendance" button.

---

## Club directory, polish, checks, and documentation (FR-15, FR-16, NFR-1 to NFR-3)

### app/clubs/page.tsx
- Server-side upcoming-event data loading and ID matching for the official read-only directory (FR-15).

### components/clubs-directory.tsx
- Interactive client-side search and filters for active clubs, upcoming events, and listed faculty mentors.
- Displays supplied club logos, source-aligned mentor details and upcoming events without changing club data (FR-15).

### lib/official-clubs.ts
- Bundles the JSS STU club names, listed mentors and supplied logo paths so the directory remains populated even before its database migration is applied.

### app/page.tsx, app/layout.tsx
- Home page links for Certificates and Clubs; proper page title and description. Loads the JSS STU site's Jost heading and Lato body fonts through `next/font`.

### supabase/migrations/event_and_registration_indexes.sql
- Indexes for the event list, seat counts, waitlist ordering, My Events and alerts, plus a covering index for `events.created_by`. Applied to the live database.

### scripts/unit-checks.ts
- 27 checks of the pure logic (IST dates, event and USN validation, seat wording, 24-hour banner window, PDF generation with long and non-Latin text). Run with `npm run check:unit`.

---

## JSS STU visual refresh and official clubs

### app/globals.css, components/navbar.tsx, components/page-shell.tsx
- Shared JSS-inspired orange, navy and warm-neutral theme; Jost headings, Lato body text, university logo in navigation, responsive page frame and footer.

### app/(auth)/login/page.tsx, app/(auth)/signup/page.tsx
- Responsive sign-in and student registration layouts using the shared campus visual language.

### supabase/migrations/official_club_directory.sql
- Adds the active-club flag, updates/creates the club directory records, and archives unlisted legacy entries without deleting their events.
- Reuses or merges event and coordinator references for clear CSI and IEEE name corrections.
- Apply this migration to an existing database; do not rerun the destructive initial schema setup.

### supabase/migrations/dsc_and_naada_clubs.sql
- Renames the legacy GDSC database record to DSC while preserving its event/coordinator links, and adds Naada as an active club.

### public/logos/
- Contains the university and 17 club logos supplied in `Clubs+logo.docx`, mapped by filename in `lib/official-clubs.ts`.

### scripts/concurrency-test.mjs
- Creates throwaway students and a 1-seat event, fires all registrations at the same instant and checks that exactly one is Confirmed. Removes everything afterwards (TC-14).

### scripts/seed-demo-data.mjs
- Creates approved sample events (or 100 for the load test) and removes them again with `--clean`.

### scripts/seed-showcase-data.ts
- Opt-in sample dataset with named club events, a pending proposal, two demo student accounts, registrations, waitlists, alerts and private certificate PDFs.
- Requires explicit confirmation for remote Supabase projects; `--clean` removes only `[SHOWCASE]` events and related records/files, leaving demo auth accounts.

### README.md, .env.example, docs/DATA_FLOW.md, docs/TEST_RESULTS.md
- Setup guide, environment template, data-flow explanation and the 25 SRS test cases with evidence.

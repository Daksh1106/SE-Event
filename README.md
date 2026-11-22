# College Event & Club Hub

One place for JSS Science and Technology University students to find campus events, register
with live seat counts and waitlists, browse the clubs directory and download participation certificates.
Software Engineering course project (SRS: *College Event and Club Hub*).

## What it does

| Role | Can do |
|------|--------|
| **Student** | Sign up with a USN, browse approved upcoming events (filter by club and date), see live seats left, register, join a waitlist, cancel, get alerts when promoted, see reminders for events within 24 hours, share an event on WhatsApp, download certificates, browse the clubs directory |
| **Coordinator** | Create events for their club, track approval status and rejection reasons, see registrations and the waitlist of their own events, mark attendance, export the confirmed list as PDF, generate certificates |
| **Approver** | Review pending events and approve or reject them (a reason is required to reject); every decision is recorded with the approver and time |
| **Admin** | Create coordinator, approver and admin accounts |

## Tech stack (fixed by the SRS)

Next.js 16 (App Router) &middot; TypeScript &middot; Tailwind CSS + shadcn/ui &middot; Supabase
(Postgres, Auth, Storage) &middot; deployed on Vercel &middot; PDFs with `pdf-lib`.

The rules that matter (seat limit, waitlist, approvals, attendance, certificates) live in
**Postgres functions** and **row level security**, not only in the UI. See `docs/DATA_FLOW.md`.

## Set up

1. `npm install`
2. Create a Supabase project, copy `.env.example` to `.env.local` and fill in the three values.
3. In the Supabase **SQL Editor**, run these files in order:
   `supabase/schema.sql`, `supabase/seed.sql`, then
   `user_roles_and_event_approvals.sql`, `authorization_and_alert_hardening.sql`,
   `event_registration_and_waitlist.sql`, `coordinator_attendance_and_certificates.sql`,
   `event_and_registration_indexes.sql`, `official_club_directory.sql`, and
   `dsc_and_naada_clubs.sql` from `supabase/migrations/`.
   The official club directory migration adds the supplied club list and archives unlisted legacy
   entries without deleting their events. The DSC and Naada migration updates those club records
   while preserving existing event and coordinator links. For an existing project that already
   has the official club directory migration applied, apply only `dsc_and_naada_clubs.sql`; do not
   rerun `schema.sql`, `seed.sql`, or earlier migrations.
4. In Supabase, **Authentication > Sign In / Providers**: turn **off** "Confirm email" and
   "Allow new users to sign up" (accounts are created by the app through the admin API).
5. Create the staff accounts (choose your own password, never commit it):
   - PowerShell: `$env:SEED_PASSWORD = "<password>"; npm run seed:users`
   - macOS/Linux: `SEED_PASSWORD="<password>" npm run seed:users`
   Existing accounts keep their existing passwords. To reset the three seeded staff accounts to
   separate passwords, enter them through PowerShell's hidden password prompts, then run the
   command. It verifies account IDs and roles before changing any passwords:
   ```powershell
   $admin = Read-Host "New ADMIN01 password" -AsSecureString
   $approver = Read-Host "New APPROV01 password" -AsSecureString
   $coordinator = Read-Host "New COORD01 password" -AsSecureString
   try {
     $env:ADMIN01_PASSWORD = [System.Net.NetworkCredential]::new("", $admin).Password
     $env:APPROV01_PASSWORD = [System.Net.NetworkCredential]::new("", $approver).Password
     $env:COORD01_PASSWORD = [System.Net.NetworkCredential]::new("", $coordinator).Password
     npm run reset:staff-passwords -- --confirm-remote
   } finally {
     Remove-Item Env:ADMIN01_PASSWORD -ErrorAction SilentlyContinue
     Remove-Item Env:APPROV01_PASSWORD -ErrorAction SilentlyContinue
     Remove-Item Env:COORD01_PASSWORD -ErrorAction SilentlyContinue
     $admin = $null; $approver = $null; $coordinator = $null
   }
   ```
   Use distinct passwords of at least 12 characters. The script does not print or save them.
6. To add optional showcase data, set a password of at least 8 characters for the two demo students and run:
   - PowerShell: `$env:SHOWCASE_PASSWORD = "<demo password>"; npm run seed:showcase -- --confirm-remote`
   - macOS/Linux: `SHOWCASE_PASSWORD="<demo password>" npm run seed:showcase -- --confirm-remote`
   It creates clearly labelled sample events (FOSSCAMP, FOSSBYTES, ENIGMA, TECHNOLOGIX,
   Electro Vaganza, Convivial and Adventure Junkyard), registrations, waitlists, unread alerts
   and two private certificate PDFs. Dates, venues and details are fictional samples, not official
   event announcements. `--confirm-remote` is required for hosted Supabase projects.
   The demo students sign in as `SHOWCASE01` and `SHOWCASE02`, using the password you set.
   To remove showcase events and their related records/files, run
   `npm run seed:showcase -- --clean --confirm-remote`; the demo auth accounts are kept.
7. `npm run dev` and open http://localhost:3000.

Deploy: push to GitHub, import the repo in Vercel, add the same three environment variables.

## Handy commands

| Command | Purpose |
|---------|---------|
| `npm run check:unit` | Logic checks (dates, validation, seat wording, PDFs). No database needed |
| `npm run check:security` | Attack scenarios against your Supabase project (roles, RLS, anon access) |
| `npm run check:concurrency` | Many students grab the last seat at the same instant (TC-14) |
| `npm run seed:demo` | Sample approved events (`-- --count 100` for the load test, `-- --clean` to remove) |
| `npm run seed:showcase` | Clearly labelled sample events, demo bookings/waitlists, alerts and certificates |
| `npm run lint` / `npm run build` | Code quality and production build |

## Project layout

```
app/            Next.js routes, layouts and route-private server actions/components
components/layout/  shared navigation and page frames
components/features/ feature UI such as clubs directory and seat badges
components/ui/  shadcn/ui primitives
public/logos/   university logo and supplied club logos
lib/            Supabase clients, role guard, dates (IST), seat wording, PDF builders, validation
types/          database types
proxy.ts        session refresh and login redirect (Next 16 "middleware")
supabase/       schema, seed data and migrations (every migration is applied to the live project)
scripts/        seed, security, concurrency and unit checks
docs/           FILE_NOTES (every file explained), DATA_FLOW, TEST_RESULTS, SECURITY_FINDINGS
```

## Documentation

- `docs/FILE_NOTES.md`: what each file does (SRS Appendix B)
- `docs/DATA_FLOW.md`: how data moves and where each rule is enforced
- `docs/TEST_RESULTS.md`: the 25 SRS test cases with evidence and what is left to check by hand
- `docs/SECURITY_FINDINGS.md`: known security findings and their status

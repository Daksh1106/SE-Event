# Security Findings Register

Findings from reviewing the repository and database setup. Severity is for this project's
context (a public GitHub repo, a deployed site, and a live Supabase project).

| ID | Severity | Status | Summary |
|----|----------|--------|---------|
| SF-1 | High | **Open (risk accepted by project owner, 2026-11-15)** | Default staff password was hardcoded in a public repo |
| SF-2 | Low | **Fixed** (applied 2026-11-15) | `decide_event` and the RLS helpers executable by the `anon` role |
| SF-3 | Low | **Fixed** (applied 2026-11-15) | Students could edit any column of their own alerts |
| SF-4 | Low | Open (by design) | Helper functions callable by any signed-in user |
| SF-5 | Info | Open | Public repo documents the RLS setup |
| SF-6 | Info | Open (accepted) | Trigger functions show as API-callable in the Supabase advisor |
| SF-7 | Low | Open | Leaked-password protection is off in Supabase Auth |
| SF-8 | Low | Open (measured, acceptable) | RLS policies call `auth.uid()` once per row (Supabase performance advisor) |
| SF-9 | Info | Open (by design) | The workflow functions are callable by signed-in users and do their own authorisation |

---

## SF-1: Default staff password in a public repository (High, Open)

**What:** Earlier versions of `scripts/seed-users.mjs` and `scripts/test-tc4-tc6.mjs` used a
fallback password whenever `SEED_PASSWORD` was not set. The repository is public, so that value
is readable in the files and permanently in git history.

**Impact:** If ADMIN01, APPROV01 or COORD01 were created without setting `SEED_PASSWORD`, they
use a publicly known password and the staff IDs are also in the repo. Anyone who can reach the
login page could sign in as admin: create staff accounts, approve or reject any event, and view
all registrations (FR-3, FR-5, NFR-8, NFR-10).

**Status:** The fallback has been removed from the current code, so new seeds must supply a
password. The live accounts were **not** changed. The project owner decided on 2026-11-15 to
continue development with the current accounts and revisit later. Removing the value from the
current files does not remove it from git history.

**Remediation (do before demo or submission):**
1. Reset the password of every seeded staff account in Supabase (Authentication, Users), or call
   `admin.updateUserById` from a server-side script.
2. Treat the old value as compromised: do not reuse it anywhere.
3. Make the repository private, or accept that its history is public. Add teammates and the
   teacher as collaborators if it is made private.
4. Re-run `node scripts/security-check.mjs` and TC-4 to TC-6 afterwards, supplying the new
   password through the `SEED_PASSWORD` environment variable.

## SF-2: `decide_event` and RLS helpers executable by `anon` (Low, Fixed)

PostgreSQL grants `EXECUTE` on new functions to `PUBLIC`, so the logged-out role could call
`decide_event` and the helper functions through the API. `decide_event` rejects callers without
`auth.uid()`, so no data could change, but the exposure was unnecessary.
`supabase/migrations/authorization_and_alert_hardening.sql` revokes it from `PUBLIC` and `anon`. It was applied to the live
project on 2026-11-15 and confirmed by re-querying the privileges and re-running the Supabase
security advisor (logged-out-callable warnings dropped from 6 to 2, the remaining two being
SF-6). Check (i) in `scripts/security-check.mjs` re-verifies this.

## SF-3: Alerts editable beyond `is_read` (Low)

The policy "Users can update own alerts" limits which rows a student can update, not which
columns. A student could rewrite the text of their own alert. `authorization_and_alert_hardening.sql` restricts updates to
`is_read` (applied 2026-11-15; confirmed by querying column privileges). Check (j) verifies both
the block and that marking an alert as read still works.

## SF-4: Helper functions callable by signed-in users (Low, Open by design)

`get_user_role(uuid)`, `get_user_club_id(uuid)` and `is_event_coordinator(uuid, uuid)` are
`SECURITY DEFINER` functions used by the RLS policies, so they must stay executable by
`authenticated`. Logged-out access was removed (SF-2). Any signed-in user can still look up the
role or club of a user ID they already know. User IDs are random UUIDs and are not
exposed to other students, so the practical risk is low. Revisit if profiles ever become
visible across roles.

## SF-6: Trigger functions listed as API-callable (Info, Open, accepted)

`handle_new_user()` and `sync_approval_to_event()` are trigger functions. They cannot be
invoked as ordinary functions through the API, so the Supabase advisor warning is not
exploitable. Their privileges were left unchanged on purpose: revoking them risks breaking
account creation. Revisit only if a test of signup after the change is available.

## SF-7: Leaked-password protection disabled (Low, Open)

Supabase Auth can reject passwords found in known breaches, but the feature is off for this
project (it may depend on the Supabase plan). The signup rule only requires 6 characters.
Consider a longer minimum in `lib/validations/auth.ts` if this matters for the demo.

## SF-8: RLS policies evaluate `auth.uid()` per row (Low, Open)

The advisor reports ten policies that call `auth.uid()` directly. Wrapping the call as
`(select auth.uid())` lets Postgres evaluate it once per query. It matters only at large row counts.
Measured under these policies, listing 101 approved events took about 1.4 ms and the seat counts
for all of them about 2.8 ms (database time), far inside the 3-second target (NFR-3, TC-23). The
policies were left unchanged to avoid rewriting live security rules without a UI to retest.

## SF-9: Workflow functions callable by signed-in users (Info, by design)

`register_for_event`, `cancel_registration`, `get_seat_counts`, `get_my_registrations`,
`get_event_registrations`, `mark_attendance`, `record_certificate` and `decide_event` are
`SECURITY DEFINER` functions the Supabase advisor lists as callable by signed-in users. That is
intended: they are the application's API. Each one checks `auth.uid()` and the caller's role or
ownership itself (verified in docs/TEST_RESULTS.md), and none can be called by the logged-out role.

## SF-5: Public repository documents the RLS setup (Info, Open)

The repository's schema, migrations, `docs/DATA_FLOW.md`, and application code describe the
security design to anyone reading the public repo. This is acceptable for coursework, but making
the repository private would reduce that exposure.

---

## How to run the checks

`scripts/security-check.mjs` and `scripts/test-tc4-tc6.mjs` run against the Supabase project in
`.env.local` and create then remove throwaway rows.

```powershell
node scripts/security-check.mjs

$env:SEED_PASSWORD = "<current staff password>"
node scripts/test-tc4-tc6.mjs
```

Prerequisites: `seed-users.mjs` has been run (ADMIN01 must exist). `authorization_and_alert_hardening.sql` is already
applied to the live project; checks (i) and (j) would fail on a database where it is not.

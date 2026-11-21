# Test results (SRS Appendix C)

How each of the 25 SRS test cases was checked, and what is still left to do by hand.
Nothing here is guessed: every "Verified" has the evidence next to it.

**Legend**
- **Verified**: run and passed.
- **Verified (database)**: the rule was run against the live Supabase rules (real policies and
  functions) with throwaway users inside a transaction that was rolled back, so no test data
  remains. The page or button on top of it still needs one manual look.
- **Manual**: can only be checked in a running browser; the steps are at the end.

| Test | Status | Evidence / what is left |
|------|--------|--------------------------|
| TC-1 Create account, invalid USN | **Verified** | Live account check passed; `npm run check:unit` checks the USN rule (valid accepted and upper-cased, `INVALID` and `12345` rejected) |
| TC-2 Duplicate USN | **Verified** | Live signup check: second account with the same USN rejected. The signup action maps Supabase's `email_exists` code to "An account with this USN already exists". Manual: read the message once in the browser |
| TC-3 Login, logout, hashed password | **Verified** | Live sign-in check: wrong password refused, right one works; passwords are bcrypt hashes inside Supabase Auth |
| TC-4 Role protection, admin creates coordinator | **Verified (database)** | A student cannot change their own role or club; a signup that asks for `role: admin` becomes a student with no club; a student, a coordinator and a logged-out caller cannot call `decide_event`. Manual: open `/coordinator`, `/approver`, `/admin/users` as a student (expect redirect) and create a coordinator from `/admin/users` (or run `scripts/test-tc4-tc6.mjs`) |
| TC-5 Create event, missing field | **Verified (database)** | Coordinator's event saved as Pending; an event for another club, a self-approved event and an event without a title are refused. `check:unit` covers the form rules (seats > 0, future date, deadline before the event) |
| TC-6 Approval flow | **Verified (database)** | Pending event invisible to the student; after approval it is visible and the approval row holds approver and time; reject without a reason is refused; rejection with a reason is shown to the coordinator |
| TC-7 Event list and filters | **Manual** | Code lists approved events from now on only, filter by club and by IST day. Check: apply a club filter and a date filter |
| TC-8 Event page | **Manual** | Page shows description, venue, fee, contact, deadline and live seats. Check visually |
| TC-9 Register with free seats | **Verified (database)** | First registration Confirmed; seats taken goes up by 1 |
| TC-10 Register twice | **Verified (database)** | "You are already registered for this event." |
| TC-11 Register after deadline | **Verified (database)** | "Registration for this event has closed." |
| TC-12 Full event | **Verified (database)** | Third and fourth students on a 2-seat event are Waitlisted at positions 1 and 2 |
| TC-13 Cancel promotes | **Verified (database)** | Cancelling a confirmed seat confirms the first waitlisted student, seats stay at 2 of 2, the next student moves to position 1. Also checked: a student cannot cancel someone else's registration, a waitlisted student leaving shifts positions, re-registering joins the back of the line (this test found and fixed an ordering flaw) |
| TC-14 Last seat at the same moment | **Partly verified** | The function locks the event row, and registrations were verified one after another. A real simultaneous race could not be run from my environment. Run `npm run check:concurrency` (20 students, 1 seat): expect exactly 1 Confirmed |
| TC-15 200 registrations | **Verified (database)** | 205 students on a 200-seat event: 200 Confirmed, 5 Waitlisted, no errors, limit never exceeded (205 registrations in 55 ms) |
| TC-16 24-hour banner and alert | **Verified (database)** + unit | The promoted student gets an alert row; `check:unit` verifies the 24-hour window. Manual: see the banner and the alert on My Events |
| TC-17 Coordinator registrations and PDF | **Verified (database)** + PDF | Own club's list returned; another club's coordinator and a student refused. The PDF was generated for 205 students (6 pages, page numbers) and inspected visually. Manual: press Export on a real event |
| TC-18 Attendance | **Verified (database)** | Only ticked confirmed students become Attended; waitlisted ids are ignored; another club's coordinator is refused; attendance cannot be withdrawn after a certificate was issued |
| TC-19 Certificates | **Verified (database)** + PDF | Certificate rows only for attended students; wrong file path and other club refused. Certificates rendered and inspected (club colours, long names shrink, long titles wrap). Manual: press Generate on a real event to exercise the storage upload |
| TC-20 Download own certificate only | **Verified (database)** | A student sees only their own certificate rows and only files in their own storage folder. Manual: download your own, then change the event id in the link (expect 404) |
| TC-21 Clubs directory | **Manual** | Verify all 16 official club names, listed mentors, search and filters. Apply `official_club_directory.sql` to connect database-backed upcoming events. No mentor is invented for clubs without one on the university page. |
| TC-22 WhatsApp share | **Manual** | The button opens `wa.me` with title, date, venue and the event link. Check by clicking it |
| TC-23 100 events load | **Verified (database)** | 101 approved events listed in about 1.4 ms and their seat counts in 2.8 ms of database time. Manual: `npm run seed:demo -- --count 100`, open `/events` on the deployed site, then `--clean` |
| TC-24 360 px and click count | **Manual** | Mobile-first layouts, tables scroll inside their own box, the navbar has a Menu on phones. After login: Home, Browse Events, event, Register = **3 clicks**. Check at 360 px width |
| TC-25 Inspection | **Partly verified** | Stack as stated: Next.js, TypeScript, Tailwind, Supabase (`package.json`). Git history: one commit per day with requirement ids. Stored personal fields: USN, optional name, phone and email, plus role; NFR-12 now includes the optional name. No analytics, ads or tracking libraries are installed, and the only outside address in the code is `wa.me`, opened when a user presses Share. Manual: open the site in Chrome, Edge, Firefox and Safari |

## Manual checks (about 15 minutes)

1. Sign in as a student on the deployed site. Open the main pages in a 360 px wide window
   (Chrome DevTools, device toolbar). Nothing should need sideways scrolling.
2. As a coordinator, create an event; as the approver, approve it.
3. Register two or three students, cancel one and watch My Events and the alert.
4. As the coordinator, open the event from the dashboard, tick attendance, export the PDF,
   generate certificates, then download one as that student.
5. Press Share on WhatsApp on an event page.
6. Repeat steps 1 and 3 in Edge, Firefox and Safari.

## Checks you can re-run any time

| Command | What it proves |
|---------|----------------|
| `npm run check:unit` | 27 logic checks (dates, validation, seats, banner window, PDFs) |
| `npm run check:security` | 10 attack scenarios against your live project |
| `npm run check:concurrency` | the seat limit under simultaneous registration |
| `npm run build` | the production build compiles every page |

## Known limitations

- PDFs use built-in fonts, so characters outside Latin-1 (for example Kannada) print as `?`.
- `SF-1` (default staff password in the public history) is documented and still open; see
  `docs/SECURITY_FINDINGS.md`.

# How data flows and where each rule lives (SRS Appendix B)

## Layers

```
Browser (pages, client components)
   |  forms, buttons, polling the seats API
   v
Next.js server (server components, server actions, API routes)   <- only place that talks to the database
   |  Supabase client with the user's session cookie
   v
Supabase: Auth (who are you) + Postgres (row level security + functions) + Storage (certificate PDFs)
```

The browser never queries the database. Client components call server actions or `/api/...`
routes, which call Supabase as the signed-in user. The secret (service role) key is used only in
two places: creating accounts (`app/(auth)/_actions/auth-actions.ts`, `app/admin/users/_actions/manage-user-actions.ts`) and
uploading certificate PDFs (`app/coordinator/events/[id]/_actions/coordinator-event-actions.ts`).

## Three lines of defence

1. **Pages and actions** check the role (`requireRole`) so the wrong person sees a redirect.
2. **Row level security** limits which rows each role can read or change, even if a page had a bug.
3. **Postgres functions** hold the rules that must never be bypassed (seat limit, waitlist,
   approval, attendance, certificate issuing). They check `auth.uid()` and the role themselves.

## Registering for an event (FR-8, FR-9, NFR-5)

1. Student presses **Register** on `/events/[id]` (`registration-panel.tsx`).
2. `registerAction` (server action) checks the role and calls `register_for_event(event_id)`.
3. In ONE database transaction the function: locks the event row (so two students are handled one
   after the other), checks the event is approved and the deadline has not passed, rejects a
   second registration, counts taken seats, and saves the student as **Confirmed** or **Waitlisted**.
4. The page refreshes; `LiveSeats` also polls `/api/events/[id]/seats` every 8 seconds, which calls
   `get_seat_counts` (students cannot read other students' rows, only these totals).

Cancelling (`cancel_registration`) cancels the row and, if a confirmed seat was freed, promotes
the first waitlisted student and writes them an alert, all in the same transaction.

## Approving an event (FR-5, NFR-14)

Coordinator creates an event (status Pending, club taken from their profile, never from the form).
The approver presses Approve or Reject; `decide_event` updates the status and writes the approval
record (approver and time) together. Students never see Pending or Rejected events (RLS).

## Attendance and certificates (FR-12, FR-13, FR-14, NFR-7)

1. Coordinator ticks attendees and saves: `mark_attendance` (only for that club's event).
2. **Generate certificates**: the server reads the attended students with
   `get_event_registrations`, builds one PDF each (`lib/pdf/certificate-pdf.ts`), uploads it to the
   private `certificates` bucket as `<student id>/<event id>.pdf`, then calls `record_certificate`,
   which refuses anyone who did not attend.
3. A student downloads through `/certificates/[eventId]/download`. Two checks apply: the
   `certificates` table (RLS, own rows only) and the storage policy (own folder only).

## Where each requirement is enforced

| Rule | Enforced in |
|------|-------------|
| Role cannot be changed by the user | column privileges + trigger on `profiles` (`user_roles_and_event_approvals.sql`) |
| Seat limit never exceeded, one registration per student | `register_for_event` + unique constraint |
| Waitlist order and promotion | `register_for_event`, `cancel_registration` |
| Pending events hidden from students | RLS policy on `events` |
| Coordinator sees only their club's registrations | `get_event_registrations` |
| Certificate only for attended students | `record_certificate` |
| A student downloads only their own certificate | RLS on `certificates` + storage policy |
| Times are entered and shown in IST | `lib/datetime.ts` |

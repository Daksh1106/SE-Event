-- ==============================================================================
-- College Event & Club Hub - Event registration and waitlist
-- APPLIED to the live Supabase project on 2026-11-15 (historical migration IDs
-- "day3_registration" and "day3b_waitlist_ordering_fix"; this file contains the final version
-- of every function).
-- Requirements: FR-8, FR-9, FR-10, NFR-4, NFR-5, NFR-7, NFR-14
-- ==============================================================================

-- 1. Register for an event (one atomic operation: the event row is locked, so two students
--    can never take the same last seat)  [FR-8, FR-9, NFR-5]
--    clock_timestamp() (not now()) is used for ordering: now() is fixed at transaction start,
--    which could place a student ahead of someone who actually obtained the lock earlier.
create or replace function public.register_for_event(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_event public.events%rowtype;
  v_existing public.registrations%rowtype;
  v_had_row boolean;
  v_taken integer;
  v_status public.registration_status;
  v_reg_id uuid;
  v_reg_created timestamptz;
  v_position integer;
begin
  if v_uid is null then
    raise exception 'Please log in to register.';
  end if;
  if public.get_user_role(v_uid) <> 'student' then
    raise exception 'Only students can register for events.';
  end if;

  -- Lock the event row: concurrent registrations for the same event queue up here (NFR-5)
  select * into v_event from public.events where id = p_event_id for update;
  if not found or v_event.status <> 'approved' then
    raise exception 'Event not found.';
  end if;

  -- Registration closes automatically after the deadline (FR-8, TC-11)
  if clock_timestamp() > v_event.registration_deadline then
    raise exception 'Registration for this event has closed.';
  end if;

  select * into v_existing
  from public.registrations
  where event_id = p_event_id and student_id = v_uid
  for update;
  v_had_row := found;

  -- One registration per student per event (FR-8, TC-10)
  if v_had_row and v_existing.status <> 'cancelled' then
    raise exception 'You are already registered for this event.';
  end if;

  select count(*) into v_taken
  from public.registrations
  where event_id = p_event_id and status in ('confirmed', 'attended');

  if v_taken < v_event.seat_limit then
    v_status := 'confirmed';
  else
    v_status := 'waitlisted';
  end if;

  if v_had_row then
    -- Re-registering after a cancellation reuses the row (unique per student and event);
    -- the timestamp is reset so the student joins the back of the waitlist.
    update public.registrations
    set status = v_status, created_at = clock_timestamp()
    where id = v_existing.id
    returning id, created_at into v_reg_id, v_reg_created;
  else
    insert into public.registrations (event_id, student_id, status, created_at)
    values (p_event_id, v_uid, v_status, clock_timestamp())
    returning id, created_at into v_reg_id, v_reg_created;
  end if;

  if v_status = 'waitlisted' then
    select count(*)::int into v_position
    from public.registrations w
    where w.event_id = p_event_id
      and w.status = 'waitlisted'
      and (w.created_at, w.id) <= (v_reg_created, v_reg_id);
  end if;

  return jsonb_build_object(
    'registration_id', v_reg_id,
    'status', v_status,
    'position', v_position
  );
end;
$$;

-- 2. Cancel a registration; promote the first waitlisted student automatically  [FR-9, FR-10]
create or replace function public.cancel_registration(p_registration_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_reg public.registrations%rowtype;
  v_event public.events%rowtype;
  v_promoted public.registrations%rowtype;
  v_did_promote boolean := false;
begin
  if v_uid is null then
    raise exception 'Please log in.';
  end if;

  select * into v_reg from public.registrations where id = p_registration_id;
  if not found or v_reg.student_id <> v_uid then
    raise exception 'Registration not found.';
  end if;

  -- Same lock order as register_for_event: event row first
  select * into v_event from public.events where id = v_reg.event_id for update;

  -- Re-read after the lock so a concurrent change cannot be missed
  select * into v_reg from public.registrations where id = p_registration_id for update;
  if v_reg.status not in ('confirmed', 'waitlisted') then
    raise exception 'This registration cannot be cancelled (status: %).', v_reg.status;
  end if;
  if now() >= v_event.date_time then
    raise exception 'This event has already started, so the registration can no longer be cancelled.';
  end if;

  update public.registrations set status = 'cancelled' where id = v_reg.id;

  if v_reg.status = 'confirmed' then
    select * into v_promoted
    from public.registrations
    where event_id = v_reg.event_id and status = 'waitlisted'
    order by created_at, id
    limit 1
    for update;

    if found then
      update public.registrations set status = 'confirmed' where id = v_promoted.id;
      insert into public.alerts (user_id, event_id, message)
      values (
        v_promoted.student_id,
        v_event.id,
        'Good news! A seat opened up and you are now confirmed for "' || v_event.title || '".'
      );
      v_did_promote := true;
    end if;
  end if;

  return jsonb_build_object('cancelled', true, 'promoted_someone', v_did_promote);
end;
$$;

-- 3. Live seat counts for the event list / event page. Students cannot read other students'
--    registrations, so only aggregate numbers are exposed through this function.  [FR-7, UR-1]
create or replace function public.get_seat_counts(p_event_ids uuid[])
returns table (event_id uuid, seat_limit integer, seats_taken integer, waitlist_count integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    e.seat_limit,
    (select count(*)::int from public.registrations r
       where r.event_id = e.id and r.status in ('confirmed', 'attended')),
    (select count(*)::int from public.registrations r
       where r.event_id = e.id and r.status = 'waitlisted')
  from public.events e
  where e.id = any(p_event_ids)
    and e.status = 'approved'
    and auth.uid() is not null;
$$;

-- 4. Everything the My Events page needs in one call, for the signed-in student only.
--    Includes the waitlist position, which needs other students' rows.  [FR-10, NFR-7]
create or replace function public.get_my_registrations()
returns table (
  registration_id uuid,
  event_id uuid,
  reg_status public.registration_status,
  registered_at timestamptz,
  waitlist_position integer,
  title text,
  date_time timestamptz,
  venue text,
  fee numeric,
  registration_deadline timestamptz,
  club_name text,
  certificate_issued boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    e.id,
    r.status,
    r.created_at,
    case when r.status = 'waitlisted' then
      (select count(*)::int from public.registrations w
         where w.event_id = r.event_id
           and w.status = 'waitlisted'
           and (w.created_at, w.id) <= (r.created_at, r.id))
    end,
    e.title,
    e.date_time,
    e.venue,
    e.fee,
    e.registration_deadline,
    c.name,
    exists (select 1 from public.certificates ce where ce.registration_id = r.id)
  from public.registrations r
  join public.events e on e.id = r.event_id
  join public.clubs c on c.id = e.club_id
  where r.student_id = auth.uid()
    and r.status <> 'cancelled'
  order by e.date_time;
$$;

-- 5. Only signed-in users may call these (see docs/SECURITY_FINDINGS.md SF-2)
revoke execute on function public.register_for_event(uuid) from public, anon;
revoke execute on function public.cancel_registration(uuid) from public, anon;
revoke execute on function public.get_seat_counts(uuid[]) from public, anon;
revoke execute on function public.get_my_registrations() from public, anon;
grant execute on function public.register_for_event(uuid) to authenticated;
grant execute on function public.cancel_registration(uuid) to authenticated;
grant execute on function public.get_seat_counts(uuid[]) to authenticated;
grant execute on function public.get_my_registrations() to authenticated;

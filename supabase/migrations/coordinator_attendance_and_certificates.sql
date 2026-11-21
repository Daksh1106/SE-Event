-- ==============================================================================
-- College Event & Club Hub - Coordinator attendance and certificates
-- APPLIED to the live Supabase project on 2026-11-15
-- (historical migration ID: day5_coordinator_certificates).
-- Requirements: FR-11, FR-12, FR-13, FR-14, NFR-7, NFR-8
-- ==============================================================================

-- 1. Registrations + waitlist of ONE event, for that club's coordinator (or admin) only.
--    Coordinators cannot read student profiles directly, so this function returns exactly the
--    fields an event organiser needs.  [FR-11, NFR-8, TC-17]
create or replace function public.get_event_registrations(p_event_id uuid)
returns table (
  registration_id uuid,
  student_id uuid,
  usn text,
  student_name text,
  phone text,
  email text,
  reg_status public.registration_status,
  registered_at timestamptz,
  waitlist_position integer,
  certificate_issued boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_club uuid;
  v_role public.app_role;
begin
  if v_uid is null then
    raise exception 'Authentication required.';
  end if;

  select e.club_id into v_club from public.events e where e.id = p_event_id;
  if not found then
    raise exception 'Event not found.';
  end if;

  v_role := public.get_user_role(v_uid);
  if not (v_role = 'admin' or (v_role = 'coordinator' and public.get_user_club_id(v_uid) = v_club)) then
    raise exception 'Access denied: you can only manage registrations of your own club''s events.';
  end if;

  return query
    select
      r.id,
      r.student_id,
      p.usn,
      p.name,
      p.phone,
      p.email,
      r.status,
      r.created_at,
      case when r.status = 'waitlisted' then
        (select count(*)::int from public.registrations w
           where w.event_id = r.event_id
             and w.status = 'waitlisted'
             and (w.created_at, w.id) <= (r.created_at, r.id))
      end,
      exists (select 1 from public.certificates c where c.registration_id = r.id)
    from public.registrations r
    join public.profiles p on p.id = r.student_id
    where r.event_id = p_event_id
      and r.status <> 'cancelled'
    order by case when r.status = 'waitlisted' then 1 else 0 end, r.created_at, r.id;
end;
$$;

-- 2. Attendance: the coordinator submits the full list of attendees; everyone else who is
--    confirmed stays (or goes back to) Confirmed.  [FR-12, TC-18]
create or replace function public.mark_attendance(p_event_id uuid, p_attended_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_club uuid;
  v_role public.app_role;
  v_blocked text;
  v_attended integer;
  v_ids uuid[] := coalesce(p_attended_ids, '{}'::uuid[]);
begin
  if v_uid is null then
    raise exception 'Authentication required.';
  end if;

  select e.club_id into v_club from public.events e where e.id = p_event_id;
  if not found then
    raise exception 'Event not found.';
  end if;

  v_role := public.get_user_role(v_uid);
  if not (v_role = 'admin' or (v_role = 'coordinator' and public.get_user_club_id(v_uid) = v_club)) then
    raise exception 'Access denied: you can only mark attendance for your own club''s events.';
  end if;

  -- Serialise with registrations and cancellations on the same event
  perform 1 from public.events where id = p_event_id for update;

  -- Attendance cannot be withdrawn once a certificate has been issued
  select string_agg(p.usn, ', ') into v_blocked
  from public.registrations r
  join public.profiles p on p.id = r.student_id
  where r.event_id = p_event_id
    and r.status = 'attended'
    and not (r.id = any(v_ids))
    and exists (select 1 from public.certificates c where c.registration_id = r.id);
  if v_blocked is not null then
    raise exception 'A certificate was already issued to: %. Their attendance cannot be withdrawn.', v_blocked;
  end if;

  update public.registrations
  set status = case when id = any(v_ids) then 'attended'::public.registration_status
                    else 'confirmed'::public.registration_status end
  where event_id = p_event_id
    and status in ('confirmed', 'attended');

  select count(*)::int into v_attended
  from public.registrations
  where event_id = p_event_id and status = 'attended';

  return jsonb_build_object('attended', v_attended);
end;
$$;

-- 3. Record an issued certificate. The database itself checks that the student attended and that
--    the caller runs this club's event, so a certificate row can never exist for someone who did
--    not attend.  [FR-13, TC-19]
create or replace function public.record_certificate(p_registration_id uuid, p_file_path text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_reg public.registrations%rowtype;
  v_club uuid;
  v_role public.app_role;
begin
  if v_uid is null then
    raise exception 'Authentication required.';
  end if;

  select * into v_reg from public.registrations where id = p_registration_id;
  if not found then
    raise exception 'Registration not found.';
  end if;

  select e.club_id into v_club from public.events e where e.id = v_reg.event_id;
  v_role := public.get_user_role(v_uid);
  if not (v_role = 'admin' or (v_role = 'coordinator' and public.get_user_club_id(v_uid) = v_club)) then
    raise exception 'Access denied: you can only issue certificates for your own club''s events.';
  end if;

  if v_reg.status <> 'attended' then
    raise exception 'Certificates can only be issued to students marked as attended.';
  end if;

  -- The file must live in the student's own folder (storage policy relies on this)
  if p_file_path <> v_reg.student_id::text || '/' || v_reg.event_id::text || '.pdf' then
    raise exception 'Unexpected certificate file path.';
  end if;

  insert into public.certificates (registration_id, event_id, student_id, file_path)
  values (v_reg.id, v_reg.event_id, v_reg.student_id, p_file_path)
  on conflict (event_id, student_id)
  do update set registration_id = excluded.registration_id,
                file_path = excluded.file_path,
                issued_on = now();

  return jsonb_build_object('registration_id', v_reg.id, 'file_path', p_file_path);
end;
$$;

revoke execute on function public.get_event_registrations(uuid) from public, anon;
revoke execute on function public.mark_attendance(uuid, uuid[]) from public, anon;
revoke execute on function public.record_certificate(uuid, text) from public, anon;
grant execute on function public.get_event_registrations(uuid) to authenticated;
grant execute on function public.mark_attendance(uuid, uuid[]) to authenticated;
grant execute on function public.record_certificate(uuid, text) to authenticated;

-- 4. Certificates are written only by record_certificate(); remove any direct write policy
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'certificates' and cmd <> 'SELECT'
  loop
    execute format('drop policy %I on public.certificates', pol.policyname);
  end loop;
end $$;

-- 5. Private storage bucket for certificate PDFs, one folder per student (NFR-7)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certificates', 'certificates', false, 2097152, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Students read own certificate files" on storage.objects;
create policy "Students read own certificate files"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'certificates' and (storage.foldername(name))[1] = auth.uid()::text);

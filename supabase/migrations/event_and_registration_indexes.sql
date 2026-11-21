-- ==============================================================================
-- College Event & Club Hub - Event and registration indexes
-- APPLIED to the live Supabase project on 2026-11-15 (historical migration ID: day6_indexes).
-- Requirements: NFR-3 (event list loads fast with 100+ events), NFR-4 (200+ registrations per event)
-- ==============================================================================

create index if not exists idx_events_status_datetime on public.events (status, date_time);
create index if not exists idx_events_club on public.events (club_id);
create index if not exists idx_registrations_event_status_created on public.registrations (event_id, status, created_at, id);
create index if not exists idx_registrations_student on public.registrations (student_id);
create index if not exists idx_alerts_user_read_created on public.alerts (user_id, is_read, created_at desc);
create index if not exists idx_alerts_event on public.alerts (event_id);
create index if not exists idx_certificates_student on public.certificates (student_id);
create index if not exists idx_certificates_registration on public.certificates (registration_id);
create index if not exists idx_approvals_approver on public.approvals (approver_id);
create index if not exists idx_profiles_club on public.profiles (club_id);

-- Applied afterwards as migration "day6b_events_created_by_index" (advisor: unindexed foreign key)
create index if not exists idx_events_created_by on public.events (created_by);

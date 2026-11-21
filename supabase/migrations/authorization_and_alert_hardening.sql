-- ==============================================================================
-- College Event & Club Hub - Authorization and alert hardening
-- APPLIED to the live Supabase project on 2026-11-15 (historical migration ID: day2b_hardening).
-- Run in Supabase SQL Editor AFTER user_roles_and_event_approvals.sql. Safe to re-run.
-- Requirements: NFR-7, NFR-8, NFR-14 (see docs/SECURITY_FINDINGS.md SF-2, SF-3, SF-4)
-- ==============================================================================

-- 1. decide_event: signed-in users only.
-- Postgres grants EXECUTE to PUBLIC by default, so the logged-out (anon) role could call the
-- function through the API. The function already rejects callers without auth.uid(); this
-- removes the exposure itself.
REVOKE EXECUTE ON FUNCTION public.decide_event(uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.decide_event(uuid, text, text) TO authenticated;

-- 2. RLS helper functions: signed-in users only.
-- Every RLS policy in this project is "TO authenticated", so the anon role never evaluates
-- these helpers and does not need EXECUTE on them.
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid), public.get_user_club_id(uuid),
                           public.is_event_coordinator(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_user_role(uuid), public.get_user_club_id(uuid),
                           public.is_event_coordinator(uuid, uuid) TO authenticated;

-- 3. alerts: a student may only mark their own alerts as read.
-- The RLS policy "Users can update own alerts" limits WHICH rows; this limits WHICH columns,
-- so message, user_id and event_id can no longer be edited from the client.
REVOKE UPDATE ON public.alerts FROM anon, authenticated;
GRANT  UPDATE (is_read) ON public.alerts TO authenticated;

-- 4. prevent_role_or_usn_change(): pin the search_path (Supabase advisor: function_search_path_mutable)
ALTER FUNCTION public.prevent_role_or_usn_change() SET search_path = public;

-- NOT changed on purpose: trigger functions handle_new_user() and sync_approval_to_event().
-- Trigger functions cannot be invoked as normal functions through the API, and revoking their
-- privileges risks breaking signup for no practical gain (docs/SECURITY_FINDINGS.md SF-6).

-- 5. Verify (expected results in comments)
-- decide_event and the three helpers: authenticated, postgres, service_role (no PUBLIC / anon)
SELECT routine_name, string_agg(grantee, ', ' ORDER BY grantee) AS can_execute
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN ('decide_event', 'get_user_role', 'get_user_club_id', 'is_event_coordinator')
GROUP BY routine_name ORDER BY routine_name;

-- alerts: only is_read for authenticated; no rows for anon
SELECT grantee, string_agg(column_name, ', ' ORDER BY column_name) AS updatable_columns
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'alerts'
  AND privilege_type = 'UPDATE' AND grantee IN ('anon', 'authenticated')
GROUP BY grantee;

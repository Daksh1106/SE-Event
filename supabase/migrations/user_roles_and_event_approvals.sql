-- ==============================================================================
-- College Event & Club Hub - User roles and event approvals
-- Requirements: FR-3, FR-4, FR-5, NFR-7, NFR-8, NFR-14
-- ==============================================================================

-- 1. Add club_id column to profiles (for coordinator-club affiliation)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL;

-- Ensure approvals.status uses public.event_status enum
-- The original text CHECK constraint must be dropped first, otherwise the type change fails with
-- "operator does not exist: event_status = text" (hit when this migration was first applied).
ALTER TABLE public.approvals
DROP CONSTRAINT IF EXISTS approvals_status_check;

ALTER TABLE public.approvals
ALTER COLUMN status TYPE public.event_status USING status::public.event_status;

-- 2. Helper function to fetch user's club_id without RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_club_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT club_id FROM public.profiles WHERE id = p_user_id;
$$;

-- 3. Update handle_new_user() trigger (FR-1, FR-3, NFR-8)
-- Security: NEVER reads role or club_id from user metadata (publicly controllable via auth.signUp).
-- Always sets role = 'student' and club_id = NULL.
-- USN is parsed strictly from the synthetic email local-part.
-- Contact email is saved ONLY if explicitly provided in metadata (no fallback to synthetic email).
-- Does NOT alter club_id on conflict.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, usn, name, phone, email, role, club_id)
  VALUES (
    NEW.id,
    UPPER(SPLIT_PART(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'contact_email',
    'student'::public.app_role,
    NULL
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

-- 4. Role, USN, and Club Affiliation protection trigger (FR-3, NFR-8)
-- Notice: NO SECURITY DEFINER, ensuring current_user reflects the actual caller (e.g. 'authenticated')
CREATE OR REPLACE FUNCTION public.prevent_role_or_usn_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.usn IS DISTINCT FROM OLD.usn OR NEW.club_id IS DISTINCT FROM OLD.club_id) THEN
    -- Block modifications unless executed in trusted administrative context
    IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
      RAISE EXCEPTION 'Permission denied: roles, USNs, and club affiliations are immutable by client users (FR-3, NFR-8).';
    END IF;
  END IF;
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

-- 5. Strict Column Privileges (FR-3, NFR-8)
-- Authenticated users can ONLY update safe personal contact attributes
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (name, phone, email) ON public.profiles TO authenticated;

-- 6. Refined RLS Policies

-- 6.1 PROFILES
DROP POLICY IF EXISTS "Profiles are readable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Profiles select policy" ON public.profiles;
CREATE POLICY "Profiles select policy"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR public.get_user_role(auth.uid()) IN ('admin', 'approver')
  );

-- 6.2 EVENTS
DROP POLICY IF EXISTS "Events viewable by approval status and role" ON public.events;
CREATE POLICY "Events viewable by approval status and role"
  ON public.events
  FOR SELECT
  TO authenticated
  USING (
    status = 'approved'::public.event_status
    OR (
      public.get_user_role(auth.uid()) = 'coordinator'
      AND club_id = public.get_user_club_id(auth.uid())
    )
    OR public.get_user_role(auth.uid()) IN ('approver', 'admin')
  );

DROP POLICY IF EXISTS "Coordinators and admins can insert events" ON public.events;
CREATE POLICY "Coordinators and admins can insert events"
  ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      public.get_user_role(auth.uid()) = 'coordinator'
      AND club_id = public.get_user_club_id(auth.uid())
      AND auth.uid() = created_by
      AND status = 'pending'
    )
    OR public.get_user_role(auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "Coordinators can update pending events" ON public.events;
CREATE POLICY "Coordinators can update pending events"
  ON public.events
  FOR UPDATE
  TO authenticated
  USING (
    (
      public.get_user_role(auth.uid()) = 'coordinator'
      AND club_id = public.get_user_club_id(auth.uid())
      AND auth.uid() = created_by
      AND status = 'pending'
    )
    OR public.get_user_role(auth.uid()) = 'admin'
  );

-- 6.3 REGISTRATIONS
-- Drop ALL write policies on registrations (only SECURITY DEFINER functions will write)
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.registrations;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.registrations;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.registrations;
DROP POLICY IF EXISTS "Users can insert registrations" ON public.registrations;
DROP POLICY IF EXISTS "Users can update registrations" ON public.registrations;
DROP POLICY IF EXISTS "Users can view own registrations or event coordinators can view" ON public.registrations;
DROP POLICY IF EXISTS "Registrations select policy" ON public.registrations;

CREATE POLICY "Registrations select policy"
  ON public.registrations
  FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR (
      public.get_user_role(auth.uid()) = 'coordinator'
      AND event_id IN (
        SELECT e.id FROM public.events e WHERE e.club_id = public.get_user_club_id(auth.uid())
      )
    )
    OR public.get_user_role(auth.uid()) IN ('approver', 'admin')
  );

-- 6.4 APPROVALS
-- Drop ALL write policies on approvals (written strictly through decide_event function)
DROP POLICY IF EXISTS "Approvers can insert approvals" ON public.approvals;
DROP POLICY IF EXISTS "Approvers can update approvals" ON public.approvals;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.approvals;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.approvals;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.approvals;
DROP POLICY IF EXISTS "Approvals viewable by approvers and event coordinators" ON public.approvals;
DROP POLICY IF EXISTS "Approvals select policy" ON public.approvals;

CREATE POLICY "Approvals select policy"
  ON public.approvals
  FOR SELECT
  TO authenticated
  USING (
    approver_id = auth.uid()
    OR public.get_user_role(auth.uid()) IN ('approver', 'admin')
    OR event_id IN (
      SELECT e.id FROM public.events e WHERE e.club_id = public.get_user_club_id(auth.uid())
    )
  );

-- 7. Transactional event decision function (FR-5, NFR-14)
-- Executes in ONE transaction: validates role, updates events.status, and inserts approvals record with cast
CREATE OR REPLACE FUNCTION public.decide_event(
  p_event_id UUID,
  p_decision TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role public.app_role;
  v_event_status public.event_status;
  v_decision_clean TEXT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  v_caller_role := public.get_user_role(v_caller_id);
  IF v_caller_role NOT IN ('approver', 'admin') THEN
    RAISE EXCEPTION 'Access denied: caller must be an approver or admin (FR-5, NFR-8).';
  END IF;

  v_decision_clean := LOWER(TRIM(p_decision));
  IF v_decision_clean NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision: must be either approved or rejected.';
  END IF;

  IF v_decision_clean = 'rejected' AND (p_reason IS NULL OR TRIM(p_reason) = '') THEN
    RAISE EXCEPTION 'Rejection reason is required (FR-5).';
  END IF;

  -- Lock row for update
  SELECT status INTO v_event_status
  FROM public.events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found.';
  END IF;

  IF v_event_status != 'pending'::public.event_status THEN
    RAISE EXCEPTION 'Event is not pending approval (current status: %).', v_event_status;
  END IF;

  -- 1. Update event status
  UPDATE public.events
  SET status = v_decision_clean::public.event_status
  WHERE id = p_event_id;

  -- 2. Audit approval decision with explicit event_status cast (NFR-14)
  INSERT INTO public.approvals (event_id, approver_id, status, reason, decided_at)
  VALUES (
    p_event_id,
    v_caller_id,
    v_decision_clean::public.event_status,
    TRIM(p_reason),
    timezone('utc'::text, now())
  )
  ON CONFLICT (event_id) DO UPDATE
  SET
    approver_id = EXCLUDED.approver_id,
    status = EXCLUDED.status,
    reason = EXCLUDED.reason,
    decided_at = EXCLUDED.decided_at;

  RETURN jsonb_build_object(
    'success', true,
    'event_id', p_event_id,
    'status', v_decision_clean
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.decide_event(UUID, TEXT, TEXT) TO authenticated;

-- 8. Verify all active RLS policies in public schema
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY 1, 2;

-- ==============================================================================
-- College Event & Club Hub - Database Schema
-- Architecture: Supabase (PostgreSQL) + Row Level Security (RLS)
-- Requirements: Section 5.3, FR-1 to FR-16, NFR-5 to NFR-8, NFR-10, NFR-14
-- ==============================================================================

-- Clean up existing definitions if rerunning
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.prevent_role_or_usn_change();
DROP FUNCTION IF EXISTS public.sync_approval_to_event();
DROP FUNCTION IF EXISTS public.get_user_role(uuid);
DROP FUNCTION IF EXISTS public.is_event_coordinator(uuid, uuid);

DROP TABLE IF EXISTS public.certificates CASCADE;
DROP TABLE IF EXISTS public.alerts CASCADE;
DROP TABLE IF EXISTS public.approvals CASCADE;
DROP TABLE IF EXISTS public.registrations CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.clubs CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

DROP TYPE IF EXISTS public.registration_status CASCADE;
DROP TYPE IF EXISTS public.event_status CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;

-- ------------------------------------------------------------------------------
-- 1. ENUMS (FR-1, FR-3, FR-4, FR-5, FR-8, FR-9, FR-12)
-- ------------------------------------------------------------------------------

-- User roles: student (default), coordinator, approver, admin (FR-3, UR-10)
CREATE TYPE public.app_role AS ENUM (
  'student',
  'coordinator',
  'approver',
  'admin'
);

-- Event lifecycle status (FR-4, FR-5, Section 7.4)
CREATE TYPE public.event_status AS ENUM (
  'pending',
  'approved',
  'rejected'
);

-- Registration lifecycle status (FR-8, FR-9, FR-12, Section 7.4)
CREATE TYPE public.registration_status AS ENUM (
  'confirmed',
  'waitlisted',
  'cancelled',
  'attended'
);

-- ------------------------------------------------------------------------------
-- 2. TABLES (Section 5.3)
-- ------------------------------------------------------------------------------

-- 2.1 PROFILES (FR-1, FR-2, FR-3, NFR-6, NFR-12)
-- Stores student/staff details linked directly to Supabase auth.users
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  usn TEXT UNIQUE NOT NULL, -- Format validated in app & signup (e.g. 01JST18CS001)
  name TEXT,
  phone TEXT,
  email TEXT,
  role public.app_role NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.2 CLUBS (FR-15, UR-4)
-- Clubs directory containing name, description, and faculty mentor
CREATE TABLE public.clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  faculty_mentor TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.3 EVENTS (FR-4, FR-5, FR-6, FR-7, NFR-4, NFR-5)
-- Event entity with fee, seat limits, registration deadlines, and approval status
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  date_time TIMESTAMPTZ NOT NULL,
  venue TEXT NOT NULL,
  contact TEXT,
  fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (fee >= 0),
  seat_limit INTEGER NOT NULL CHECK (seat_limit > 0),
  registration_deadline TIMESTAMPTZ NOT NULL,
  status public.event_status NOT NULL DEFAULT 'pending',
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT chk_deadline_before_event CHECK (registration_deadline <= date_time)
);

-- 2.4 REGISTRATIONS (FR-8, FR-9, FR-11, FR-12, NFR-4, NFR-5)
-- Student registrations. Waitlist position is dynamically computed via created_at.
-- Explicit constraint UNIQUE(event_id, student_id) prevents duplicate registrations (FR-8, TC-10).
CREATE TABLE public.registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.registration_status NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_event_student UNIQUE (event_id, student_id)
);

-- 2.5 APPROVALS (FR-5, UR-9, NFR-14)
-- Audit log of faculty/HOD approval decisions for events (one record per event)
CREATE TABLE public.approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID UNIQUE NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('approved', 'rejected')),
  reason TEXT, -- Mandatory if rejected per FR-5
  decided_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.6 ALERTS (FR-10, UR-3)
-- In-app notifications shown on student My Events page (promotions, 24h reminders)
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.7 CERTIFICATES (FR-13, FR-14, UR-5, NFR-7)
-- Issued certificates for attended students, pointing to generated PDF file in Supabase Storage
CREATE TABLE public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL, -- Supabase Storage file key
  issued_on TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_certificate_event_student UNIQUE (event_id, student_id)
);

-- ------------------------------------------------------------------------------
-- 3. HELPER FUNCTIONS & TRIGGERS (FR-1, FR-3, FR-5, NFR-8, NFR-10)
-- ------------------------------------------------------------------------------

-- Helper to safely query user role without triggering recursive RLS evaluation
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id UUID)
RETURNS public.app_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    user_role public.app_role;
BEGIN
    SELECT role
    INTO user_role
    FROM public.profiles
    WHERE id = p_user_id;

    RETURN user_role;
END;
$$;

-- Helper to check if a user is the coordinator who created an event
CREATE OR REPLACE FUNCTION public.is_event_coordinator(
    p_event_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.events
        WHERE id = p_event_id
          AND created_by = p_user_id
    );
END;
$$;

-- Automatically create profile row when a new auth user is created (FR-1, FR-3)
-- Role is always locked to 'student' by default on signup; admin/coordinator roles are set by seed/admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, usn, name, phone, email, role)
  VALUES (
    NEW.id,
    UPPER(COALESCE(NEW.raw_user_meta_data->>'usn', SPLIT_PART(NEW.email, '@', 1))),
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'phone',
    NEW.email,
    'student'::public.app_role -- FR-3: Students cannot assign themselves elevated roles
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Role & USN protection trigger (FR-3, NFR-8):
-- Blocks any non-service_role / non-postgres user from altering profiles.role or profiles.usn
CREATE OR REPLACE FUNCTION public.prevent_role_or_usn_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.usn IS DISTINCT FROM OLD.usn) THEN
    -- Allow only postgres / service_role administrative context
    IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
      RAISE EXCEPTION 'Permission denied: roles and USNs are immutable by client users (FR-3, NFR-8).';
    END IF;
  END IF;
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_role_or_usn_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_or_usn_change();

-- Sync event status automatically when an approval row is created/updated (FR-5, NFR-14)
CREATE OR REPLACE FUNCTION public.sync_approval_to_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.events
  SET status = NEW.status::public.event_status
  WHERE id = NEW.event_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_approval_to_event
  AFTER INSERT OR UPDATE ON public.approvals
  FOR EACH ROW EXECUTE FUNCTION public.sync_approval_to_event();

-- ------------------------------------------------------------------------------
-- 4. COLUMN-LEVEL PRIVILEGES (FR-3, NFR-8)
-- ------------------------------------------------------------------------------
-- Extra safety layer: Authenticated users can only update safe personal fields (name, phone, email)
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (name, phone, email) ON public.profiles TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- RLS is enabled on every table. Explicit policies per role (NFR-7, NFR-8).
-- ------------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- 5.1 PROFILES POLICIES
-- Authenticated users can view profiles (to display names of coordinators, approvers, etc.)
CREATE POLICY "Profiles are readable by authenticated users"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Users can update only their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 5.2 CLUBS POLICIES (FR-15)
-- Everyone can read clubs directory
CREATE POLICY "Clubs are viewable by authenticated users"
  ON public.clubs
  FOR SELECT
  TO authenticated
  USING (true);

-- 5.3 EVENTS POLICIES (FR-4, FR-5, FR-6, FR-7, NFR-8)
-- Students see only approved events; coordinators see their own; approvers and admins see all
CREATE POLICY "Events viewable by approval status and role"
  ON public.events
  FOR SELECT
  TO authenticated
  USING (
    status = 'approved'
    OR auth.uid() = created_by
    OR public.get_user_role(auth.uid()) IN ('approver', 'admin')
  );

-- Only coordinators and admins can create events (FR-4)
CREATE POLICY "Coordinators and admins can insert events"
  ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_role(auth.uid()) IN ('coordinator', 'admin')
    AND auth.uid() = created_by
  );

-- Coordinators can update their own events if still pending (FR-4)
CREATE POLICY "Coordinators can update pending events"
  ON public.events
  FOR UPDATE
  TO authenticated
  USING (
    (auth.uid() = created_by AND status = 'pending')
    OR public.get_user_role(auth.uid()) = 'admin'
  );

-- 5.4 REGISTRATIONS POLICIES (FR-8, FR-9, FR-11, NFR-7, NFR-8)
-- Students see only their own registrations; coordinators see registrations for their events
CREATE POLICY "Users can view own registrations or event coordinators can view"
  ON public.registrations
  FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR public.is_event_coordinator(event_id, auth.uid())
    OR public.get_user_role(auth.uid()) IN ('approver', 'admin')
  );

-- CRITICAL RULE: NO INSERT/UPDATE policy for students on registrations!
-- All registration inserts, waitlist joins, cancellations, and promotions
-- MUST run through PostgreSQL functions using row locks and transactions (NFR-5).

-- 5.5 APPROVALS POLICIES (FR-5, NFR-14)
-- Viewable by approvers, admins, and the event coordinator
CREATE POLICY "Approvals viewable by approvers and event coordinators"
  ON public.approvals
  FOR SELECT
  TO authenticated
  USING (
    approver_id = auth.uid()
    OR public.is_event_coordinator(event_id, auth.uid())
    OR public.get_user_role(auth.uid()) IN ('approver', 'admin')
  );

-- Only approvers and admins can create approvals (FR-5)
CREATE POLICY "Approvers can insert approvals"
  ON public.approvals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_role(auth.uid()) IN ('approver', 'admin')
    AND auth.uid() = approver_id
  );

-- 5.6 ALERTS POLICIES (FR-10, UR-3)
-- Students can only view and update (mark read) their own alerts
CREATE POLICY "Users can view own alerts"
  ON public.alerts
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own alerts"
  ON public.alerts
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 5.7 CERTIFICATES POLICIES (FR-13, FR-14, NFR-7)
-- Students can only download/view their own certificates; coordinators view for their events
CREATE POLICY "Users can view own certificates"
  ON public.certificates
  FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR public.is_event_coordinator(event_id, auth.uid())
    OR public.get_user_role(auth.uid()) = 'admin'
  );

-- Coordinators can insert certificates for attended students of their events (FR-13)
CREATE POLICY "Coordinators can insert certificates"
  ON public.certificates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_event_coordinator(event_id, auth.uid())
    OR public.get_user_role(auth.uid()) = 'admin'
  );

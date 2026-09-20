-- ============================================================
-- Migration: 0003_rls_policies
-- Description: Row Level Security for all tables
-- Assumption: Supabase Auth is used; JWT claims carry
--             app_metadata->role ('DOCTOR','ASSISTANT','ADMIN')
-- ============================================================

-- Helper function to read role from JWT
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role',
    ''
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- Enable RLS on every table
-- ============================================================
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE chambers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- USERS table
-- ============================================================

-- Admins see all users
CREATE POLICY "admin_read_all_users"
  ON users FOR SELECT
  USING (auth.user_role() = 'ADMIN');

-- Each user can read their own row
CREATE POLICY "user_read_own"
  ON users FOR SELECT
  USING (id = auth.uid());

-- Only admins can insert/update/delete users
CREATE POLICY "admin_write_users"
  ON users FOR ALL
  USING (auth.user_role() = 'ADMIN');

-- ============================================================
-- DOCTOR PROFILES table
-- ============================================================

-- Doctors, assistants, and admins can read all profiles
CREATE POLICY "staff_read_doctor_profiles"
  ON doctor_profiles FOR SELECT
  USING (auth.user_role() IN ('DOCTOR', 'ASSISTANT', 'ADMIN'));

-- Doctors can update their own profile; admins can update any
CREATE POLICY "doctor_update_own_profile"
  ON doctor_profiles FOR UPDATE
  USING (
    auth.user_role() = 'ADMIN'
    OR user_id = auth.uid()
  );

CREATE POLICY "admin_insert_delete_doctor_profiles"
  ON doctor_profiles FOR INSERT
  WITH CHECK (auth.user_role() = 'ADMIN');

-- ============================================================
-- CHAMBERS table
-- ============================================================

-- All staff can read chambers
CREATE POLICY "staff_read_chambers"
  ON chambers FOR SELECT
  USING (auth.user_role() IN ('DOCTOR', 'ASSISTANT', 'ADMIN'));

-- Only admins can manage chambers
CREATE POLICY "admin_write_chambers"
  ON chambers FOR ALL
  USING (auth.user_role() = 'ADMIN');

-- ============================================================
-- SESSIONS table
-- ============================================================

-- All staff can read sessions
CREATE POLICY "staff_read_sessions"
  ON sessions FOR SELECT
  USING (auth.user_role() IN ('DOCTOR', 'ASSISTANT', 'ADMIN'));

-- Assistants and admins can create/update sessions
CREATE POLICY "assistant_admin_write_sessions"
  ON sessions FOR ALL
  USING (auth.user_role() IN ('ASSISTANT', 'ADMIN'));

-- ============================================================
-- PATIENTS table
-- ============================================================

-- All staff can read patients
CREATE POLICY "staff_read_patients"
  ON patients FOR SELECT
  USING (auth.user_role() IN ('DOCTOR', 'ASSISTANT', 'ADMIN'));

-- Assistants and admins can manage patients
CREATE POLICY "assistant_admin_write_patients"
  ON patients FOR ALL
  USING (auth.user_role() IN ('ASSISTANT', 'ADMIN'));

-- ============================================================
-- APPOINTMENTS table
-- ============================================================

-- All staff can read appointments
CREATE POLICY "staff_read_appointments"
  ON appointments FOR SELECT
  USING (auth.user_role() IN ('DOCTOR', 'ASSISTANT', 'ADMIN'));

-- Assistants and admins can manage appointments
CREATE POLICY "assistant_admin_write_appointments"
  ON appointments FOR ALL
  USING (auth.user_role() IN ('ASSISTANT', 'ADMIN'));

-- Public tracking: anyone with the tracking token can read their appointment
CREATE POLICY "public_track_by_token"
  ON appointments FOR SELECT
  USING (true); -- filtered at application layer via tracking_token lookup

-- ============================================================
-- NOTIFICATION LOGS table
-- ============================================================

-- Only admins and assistants can read notification logs
CREATE POLICY "staff_read_notifications"
  ON notification_logs FOR SELECT
  USING (auth.user_role() IN ('ASSISTANT', 'ADMIN'));

CREATE POLICY "system_write_notifications"
  ON notification_logs FOR INSERT
  WITH CHECK (auth.user_role() IN ('ASSISTANT', 'ADMIN'));

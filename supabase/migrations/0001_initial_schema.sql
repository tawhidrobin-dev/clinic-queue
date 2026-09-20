-- ============================================================
-- Migration: 0001_initial_schema
-- Description: Core schema for Clinic Queue App
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. ENUM TYPES
-- ============================================================

CREATE TYPE user_role AS ENUM ('DOCTOR', 'ASSISTANT', 'ADMIN');

CREATE TYPE session_status AS ENUM (
  'SCHEDULED',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE appointment_type AS ENUM (
  'NEW_PATIENT',
  'REPORT_CHECK',
  'FOLLOW_UP',
  'EMERGENCY'
);

CREATE TYPE appointment_status AS ENUM (
  'BOOKED',
  'WAITING',
  'IN_CONSULTATION',
  'COMPLETED',
  'NO_SHOW',
  'CANCELLED'
);

CREATE TYPE channel_type AS ENUM ('SMS', 'WHATSAPP');

CREATE TYPE notify_status AS ENUM ('PENDING', 'SENT', 'FAILED');

-- ============================================================
-- 2. USERS & ROLES
-- ============================================================

CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name    VARCHAR(120) NOT NULL,
  phone_number VARCHAR(15)  UNIQUE NOT NULL, -- Format: +8801XXXXXXXXX
  email        VARCHAR(120),
  role         user_role    NOT NULL,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 3. DOCTOR PROFILES
-- ============================================================

CREATE TABLE doctor_profiles (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  specialty             VARCHAR(100) NOT NULL,
  qualifications        TEXT,
  avg_consultation_mins INTEGER DEFAULT 10,
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 4. CHAMBERS / CLINICS
-- ============================================================

CREATE TABLE chambers (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id    UUID REFERENCES doctor_profiles(id) ON DELETE CASCADE,
  chamber_name VARCHAR(150) NOT NULL,
  area         VARCHAR(100) NOT NULL,
  address      TEXT         NOT NULL,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 5. DAILY CHAMBER SESSIONS
-- ============================================================

CREATE TABLE sessions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chamber_id            UUID REFERENCES chambers(id) ON DELETE CASCADE,
  scheduled_date        DATE NOT NULL,
  scheduled_start_time  TIME NOT NULL,
  actual_start_time     TIMESTAMP WITH TIME ZONE,
  actual_end_time       TIMESTAMP WITH TIME ZONE,
  status                session_status DEFAULT 'SCHEDULED',
  current_serving_serial INTEGER DEFAULT 0,
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 6. PATIENTS
-- ============================================================

CREATE TABLE patients (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name    VARCHAR(120) NOT NULL,
  phone_number VARCHAR(15)  NOT NULL,
  age          INTEGER,
  gender       VARCHAR(10),
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 7. APPOINTMENTS / QUEUE SERIALS
-- ============================================================

CREATE TABLE appointments (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id              UUID REFERENCES sessions(id) ON DELETE CASCADE,
  patient_id              UUID REFERENCES patients(id) ON DELETE CASCADE,
  serial_number           INTEGER NOT NULL,
  appointment_type        appointment_type    DEFAULT 'NEW_PATIENT',
  status                  appointment_status  DEFAULT 'BOOKED',

  -- AI & Tracking Timestamps
  estimated_consult_time  TIMESTAMP WITH TIME ZONE,
  consultation_start_time TIMESTAMP WITH TIME ZONE,
  consultation_end_time   TIMESTAMP WITH TIME ZONE,
  actual_duration_mins    INTEGER,

  -- Public tracking token (shareable link)
  tracking_token          VARCHAR(64) UNIQUE NOT NULL,

  created_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_serial_per_session UNIQUE (session_id, serial_number)
);

-- ============================================================
-- 8. NOTIFICATION LOGS
-- ============================================================

CREATE TABLE notification_logs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id   UUID REFERENCES appointments(id) ON DELETE CASCADE,
  channel          channel_type  NOT NULL,
  recipient_phone  VARCHAR(15)   NOT NULL,
  message_body     TEXT          NOT NULL,
  status           notify_status DEFAULT 'PENDING',
  sent_at          TIMESTAMP WITH TIME ZONE,
  error_message    TEXT
);

-- ============================================================
-- INDEXES FOR HIGH-PERFORMANCE QUEUE QUERIES
-- ============================================================

CREATE INDEX idx_appointments_session_status ON appointments (session_id, status);
CREATE INDEX idx_appointments_token          ON appointments (tracking_token);
CREATE INDEX idx_sessions_chamber_date       ON sessions     (chamber_id, scheduled_date);

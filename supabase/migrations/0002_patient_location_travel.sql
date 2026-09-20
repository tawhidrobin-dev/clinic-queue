-- ============================================================
-- Migration: 0002_patient_location_travel
-- Description: Add geolocation + travel intelligence columns
-- ============================================================

-- Add location fields to patients
ALTER TABLE patients
  ADD COLUMN home_latitude      NUMERIC(10, 8),
  ADD COLUMN home_longitude     NUMERIC(11, 8),
  ADD COLUMN preferred_transport VARCHAR(20) DEFAULT 'CAR'; -- 'CAR', 'CNG', 'BIKE'

-- Add travel intelligence fields to appointments
ALTER TABLE appointments
  ADD COLUMN estimated_travel_mins  INTEGER,
  ADD COLUMN recommended_leave_time TIMESTAMP WITH TIME ZONE,
  ADD COLUMN last_traffic_check     TIMESTAMP WITH TIME ZONE;

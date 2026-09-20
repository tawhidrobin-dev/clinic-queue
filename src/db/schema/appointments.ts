import {
  pgEnum,
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { sessions } from './sessions';
import { patients } from './patients';

// ============================================================
// ENUMS
// ============================================================

export const appointmentTypeEnum = pgEnum('appointment_type', [
  'NEW_PATIENT',
  'REPORT_CHECK',
  'FOLLOW_UP',
  'EMERGENCY',
]);

export const appointmentStatusEnum = pgEnum('appointment_status', [
  'BOOKED',
  'WAITING',
  'IN_CONSULTATION',
  'COMPLETED',
  'NO_SHOW',
  'CANCELLED',
]);

// ============================================================
// APPOINTMENTS TABLE
// ============================================================

export const appointments = pgTable(
  'appointments',
  {
    id:           uuid('id').primaryKey().defaultRandom(),
    sessionId:    uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }),
    patientId:    uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }),
    serialNumber: integer('serial_number').notNull(),

    appointmentType: appointmentTypeEnum('appointment_type').default('NEW_PATIENT'),
    status:          appointmentStatusEnum('status').default('BOOKED'),

    // AI & Tracking Timestamps
    estimatedConsultTime:   timestamp('estimated_consult_time', { withTimezone: true }),
    consultationStartTime:  timestamp('consultation_start_time', { withTimezone: true }),
    consultationEndTime:    timestamp('consultation_end_time', { withTimezone: true }),
    actualDurationMins:     integer('actual_duration_mins'),

    // Public tracking
    trackingToken: varchar('tracking_token', { length: 64 }).unique().notNull(),

    // Travel intelligence (from migration 0002)
    estimatedTravelMins:   integer('estimated_travel_mins'),
    recommendedLeaveTime:  timestamp('recommended_leave_time', { withTimezone: true }),
    lastTrafficCheck:      timestamp('last_traffic_check', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    // Composite unique: one serial per session
    uniqueSerialPerSession: unique('unique_serial_per_session').on(
      table.sessionId,
      table.serialNumber,
    ),
  }),
);

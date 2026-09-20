import { pgEnum, pgTable, uuid, integer, timestamp, time, date } from 'drizzle-orm/pg-core';
import { chambers } from './chambers';

// ============================================================
// ENUM
// ============================================================

export const sessionStatusEnum = pgEnum('session_status', [
  'SCHEDULED',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
]);

// ============================================================
// SESSIONS TABLE
// ============================================================

export const sessions = pgTable('sessions', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  chamberId:            uuid('chamber_id').references(() => chambers.id, { onDelete: 'cascade' }),
  scheduledDate:        date('scheduled_date').notNull(),
  scheduledStartTime:   time('scheduled_start_time').notNull(),
  actualStartTime:      timestamp('actual_start_time', { withTimezone: true }),
  actualEndTime:        timestamp('actual_end_time', { withTimezone: true }),
  status:               sessionStatusEnum('status').default('SCHEDULED'),
  currentServingSerial: integer('current_serving_serial').default(0),
  createdAt:            timestamp('created_at', { withTimezone: true }).defaultNow(),
});

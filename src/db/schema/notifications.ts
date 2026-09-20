import { pgEnum, pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { appointments } from './appointments';

// ============================================================
// ENUMS
// ============================================================

export const channelTypeEnum = pgEnum('channel_type', ['SMS', 'WHATSAPP']);

export const notifyStatusEnum = pgEnum('notify_status', ['PENDING', 'SENT', 'FAILED']);

// ============================================================
// NOTIFICATION LOGS TABLE
// ============================================================

export const notificationLogs = pgTable('notification_logs', {
  id:             uuid('id').primaryKey().defaultRandom(),
  appointmentId:  uuid('appointment_id').references(() => appointments.id, { onDelete: 'cascade' }),
  channel:        channelTypeEnum('channel').notNull(),
  recipientPhone: varchar('recipient_phone', { length: 15 }).notNull(),
  messageBody:    text('message_body').notNull(),
  status:         notifyStatusEnum('status').default('PENDING'),
  sentAt:         timestamp('sent_at', { withTimezone: true }),
  errorMessage:   text('error_message'),
});

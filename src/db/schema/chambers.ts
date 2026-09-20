import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { doctorProfiles } from './users';

// ============================================================
// CHAMBERS / CLINICS TABLE
// ============================================================

export const chambers = pgTable('chambers', {
  id:          uuid('id').primaryKey().defaultRandom(),
  doctorId:    uuid('doctor_id').references(() => doctorProfiles.id, { onDelete: 'cascade' }),
  chamberName: varchar('chamber_name', { length: 150 }).notNull(),
  area:        varchar('area', { length: 100 }).notNull(),
  address:     text('address').notNull(),
  createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow(),
});

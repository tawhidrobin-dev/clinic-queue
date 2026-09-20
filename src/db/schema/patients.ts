import { pgTable, uuid, varchar, integer, timestamp, numeric } from 'drizzle-orm/pg-core';

// ============================================================
// PATIENTS TABLE
// ============================================================

export const patients = pgTable('patients', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  fullName:           varchar('full_name', { length: 120 }).notNull(),
  phoneNumber:        varchar('phone_number', { length: 15 }).notNull(),
  age:                integer('age'),
  gender:             varchar('gender', { length: 10 }),
  createdAt:          timestamp('created_at', { withTimezone: true }).defaultNow(),

  // Geolocation (from migration 0002)
  homeLatitude:       numeric('home_latitude', { precision: 10, scale: 8 }),
  homeLongitude:      numeric('home_longitude', { precision: 11, scale: 8 }),
  preferredTransport: varchar('preferred_transport', { length: 20 }).default('CAR'),
});

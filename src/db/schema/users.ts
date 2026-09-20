import { pgEnum, pgTable, uuid, varchar, text, integer, timestamp, time, date, numeric, unique } from 'drizzle-orm/pg-core';

// ============================================================
// ENUMS
// ============================================================

export const userRoleEnum = pgEnum('user_role', ['DOCTOR', 'ASSISTANT', 'ADMIN']);

// ============================================================
// USERS TABLE
// ============================================================

export const users = pgTable('users', {
  id:          uuid('id').primaryKey().defaultRandom(),
  fullName:    varchar('full_name', { length: 120 }).notNull(),
  phoneNumber: varchar('phone_number', { length: 15 }).notNull().unique(),
  email:       varchar('email', { length: 120 }),
  role:        userRoleEnum('role').notNull(),
  createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ============================================================
// DOCTOR PROFILES TABLE
// ============================================================

export const doctorProfiles = pgTable('doctor_profiles', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  userId:               uuid('user_id').unique().references(() => users.id, { onDelete: 'cascade' }),
  specialty:            varchar('specialty', { length: 100 }).notNull(),
  qualifications:       text('qualifications'),
  avgConsultationMins:  integer('avg_consultation_mins').default(10),
  createdAt:            timestamp('created_at', { withTimezone: true }).defaultNow(),
});

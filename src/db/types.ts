import { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import {
  users,
  doctorProfiles,
  chambers,
  sessions,
  patients,
  appointments,
  notificationLogs,
} from './schema';

// ============================================================
// SELECT TYPES  — shape of a row returned from the DB
// ============================================================

export type User              = InferSelectModel<typeof users>;
export type DoctorProfile     = InferSelectModel<typeof doctorProfiles>;
export type Chamber           = InferSelectModel<typeof chambers>;
export type Session           = InferSelectModel<typeof sessions>;
export type Patient           = InferSelectModel<typeof patients>;
export type Appointment       = InferSelectModel<typeof appointments>;
export type NotificationLog   = InferSelectModel<typeof notificationLogs>;

// ============================================================
// INSERT TYPES  — shape expected when inserting a new row
// ============================================================

export type NewUser             = InferInsertModel<typeof users>;
export type NewDoctorProfile    = InferInsertModel<typeof doctorProfiles>;
export type NewChamber          = InferInsertModel<typeof chambers>;
export type NewSession          = InferInsertModel<typeof sessions>;
export type NewPatient          = InferInsertModel<typeof patients>;
export type NewAppointment      = InferInsertModel<typeof appointments>;
export type NewNotificationLog  = InferInsertModel<typeof notificationLogs>;

// ============================================================
// ENUM VALUE TYPES  — for use in application code
// ============================================================

export type UserRole          = User['role'];               // 'DOCTOR' | 'ASSISTANT' | 'ADMIN'
export type SessionStatus     = Session['status'];          // 'SCHEDULED' | 'ACTIVE' | ...
export type AppointmentType   = Appointment['appointmentType']; // 'NEW_PATIENT' | ...
export type AppointmentStatus = Appointment['status'];      // 'BOOKED' | 'WAITING' | ...
export type ChannelType       = NotificationLog['channel']; // 'SMS' | 'WHATSAPP'
export type NotifyStatus      = NotificationLog['status'];  // 'PENDING' | 'SENT' | 'FAILED'

// ============================================================
// COMPOSITE / JOINED TYPES  — for common query shapes
// ============================================================

/** A session with its parent chamber details */
export type SessionWithChamber = Session & {
  chamber: Chamber | null;
};

/** An appointment with its patient details */
export type AppointmentWithPatient = Appointment & {
  patient: Patient | null;
};

/** Full queue entry returned from the queue view endpoint */
export type QueueEntry = Appointment & {
  patient: Pick<Patient, 'fullName' | 'phoneNumber' | 'age'>;
};

/** Doctor profile with the associated user row */
export type DoctorWithUser = DoctorProfile & {
  user: Pick<User, 'fullName' | 'phoneNumber' | 'email'>;
};

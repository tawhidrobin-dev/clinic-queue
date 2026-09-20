import { eq, and, inArray, desc, asc, isNotNull } from 'drizzle-orm';
import { db } from '@/src/db';
import {
  sessions,
  chambers,
  doctorProfiles,
  appointments,
  patients,
} from '@/src/db/schema';
import type { Appointment, Session } from '@/src/db/types';
import {
  APPOINTMENT_TYPE_WEIGHTS,
  MOVING_AVERAGE_WINDOW,
  MIN_CONSULTATION_MINS,
} from './constants';
import { checkAndDispatchTimeChangeAlert } from '../notifications/sms';

export interface NextPatientResult {
  sessionId: string;
  sessionStatus: string;
  currentServingSerial: number;
  movingAverageMins: number;
  completedPatient: {
    id: string;
    serialNumber: number;
    actualDurationMins: number | null;
    status: string;
  } | null;
  currentPatient: {
    id: string;
    serialNumber: number;
    appointmentType: string | null;
    status: string;
    consultationStartTime: Date | null;
  } | null;
  waitingPatients: {
    id: string;
    serialNumber: number;
    appointmentType: string | null;
    status: string;
    estimatedConsultTime: Date | null;
    estimatedDurationMins: number;
  }[];
}

/**
 * Computes moving average consultation time for completed patients in the session.
 * Falls back to the doctor profile's avg_consultation_mins or 10 if no history is available.
 */
export async function computeMovingAverageConsultationTime(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  sessionId: string,
  doctorAvgBaselineMins: number = 10,
): Promise<number> {
  const recentCompleted = await tx
    .select({
      actualDurationMins: appointments.actualDurationMins,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.sessionId, sessionId),
        eq(appointments.status, 'COMPLETED'),
        isNotNull(appointments.actualDurationMins),
      ),
    )
    .orderBy(desc(appointments.consultationEndTime), desc(appointments.serialNumber))
    .limit(MOVING_AVERAGE_WINDOW);

  const validDurations = recentCompleted
    .map((r) => r.actualDurationMins)
    .filter((d): d is number => typeof d === 'number' && d > 0);

  if (validDurations.length === 0) {
    return Math.max(MIN_CONSULTATION_MINS, doctorAvgBaselineMins);
  }

  const sum = validDurations.reduce((acc, curr) => acc + curr, 0);
  const avg = sum / validDurations.length;

  return Math.max(MIN_CONSULTATION_MINS, Math.round(avg * 10) / 10);
}

/**
 * Calculates and recalculates estimated consult times for all waiting appointments
 * using moving average and appointment type weight multipliers.
 */
export function calculateEstimatedTimes(
  waitingList: Appointment[],
  movingAverageMins: number,
  startTime: Date,
  activePatientRemainingMins: number = 0,
): { id: string; estimatedConsultTime: Date; estimatedDurationMins: number }[] {
  let nextAvailableTimestamp = startTime.getTime() + activePatientRemainingMins * 60 * 1000;

  return waitingList.map((patient) => {
    const weight =
      (patient.appointmentType && APPOINTMENT_TYPE_WEIGHTS[patient.appointmentType]) || 1.0;
    const durationMins = Math.max(
      MIN_CONSULTATION_MINS,
      Math.round(movingAverageMins * weight),
    );

    const estimatedConsultTime = new Date(nextAvailableTimestamp);
    nextAvailableTimestamp += durationMins * 60 * 1000;

    return {
      id: patient.id,
      estimatedConsultTime,
      estimatedDurationMins: durationMins,
    };
  });
}

/**
 * Transition the session to the next patient:
 * 1. Completes any current IN_CONSULTATION patient and records duration.
 * 2. Fetches the next WAITING / BOOKED patient and transitions them to IN_CONSULTATION.
 * 3. Computes the moving average consultation time.
 * 4. Re-estimates consult times for all remaining waiting patients.
 * 5. Commits all updates atomically inside a transaction.
 */
export async function advanceToNextPatient(sessionId: string): Promise<NextPatientResult> {
  return await db.transaction(async (tx) => {
    const now = new Date();

    // 1. Fetch session and doctor profile for baseline
    const sessionRows = await tx
      .select({
        session: sessions,
        doctorAvgConsultationMins: doctorProfiles.avgConsultationMins,
        chamberName: chambers.chamberName,
      })
      .from(sessions)
      .leftJoin(chambers, eq(sessions.chamberId, chambers.id))
      .leftJoin(doctorProfiles, eq(chambers.doctorId, doctorProfiles.id))
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (sessionRows.length === 0) {
      throw new Error(`Session with ID ${sessionId} not found`);
    }

    const { session, doctorAvgConsultationMins, chamberName } = sessionRows[0];

    if (session.status === 'CANCELLED' || session.status === 'COMPLETED') {
      throw new Error(`Cannot advance session in ${session.status} status`);
    }

    const doctorBaseline = doctorAvgConsultationMins ?? 10;

    // 2. Fetch current IN_CONSULTATION patient (if any)
    const currentActiveList = await tx
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.sessionId, sessionId),
          eq(appointments.status, 'IN_CONSULTATION'),
        ),
      )
      .limit(1);

    let completedPatientData: NextPatientResult['completedPatient'] = null;

    if (currentActiveList.length > 0) {
      const active = currentActiveList[0];
      const start = active.consultationStartTime ? new Date(active.consultationStartTime) : now;
      const durationMins = Math.max(1, Math.round((now.getTime() - start.getTime()) / 60000));

      await tx
        .update(appointments)
        .set({
          status: 'COMPLETED',
          consultationEndTime: now,
          actualDurationMins: durationMins,
        })
        .where(eq(appointments.id, active.id));

      completedPatientData = {
        id: active.id,
        serialNumber: active.serialNumber,
        actualDurationMins: durationMins,
        status: 'COMPLETED',
      };
    }

    // 3. Find next patient in queue (with patient contact details)
    const nextCandidateRows = await tx
      .select({
        appointment: appointments,
        patientName: patients.fullName,
        patientPhone: patients.phoneNumber,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .where(
        and(
          eq(appointments.sessionId, sessionId),
          inArray(appointments.status, ['WAITING', 'BOOKED']),
        ),
      )
      .orderBy(
        asc(appointments.serialNumber),
      );

    let nextPatient: Appointment | null = null;
    let remainingWaitingRows: typeof nextCandidateRows = [];

    if (nextCandidateRows.length > 0) {
      nextPatient = nextCandidateRows[0].appointment;
      remainingWaitingRows = nextCandidateRows.slice(1);

      // Transition next patient to IN_CONSULTATION
      await tx
        .update(appointments)
        .set({
          status: 'IN_CONSULTATION',
          consultationStartTime: now,
          estimatedConsultTime: now,
        })
        .where(eq(appointments.id, nextPatient.id));
    }

    // 4. Update session status & current serving serial
    const newServingSerial = nextPatient ? nextPatient.serialNumber : session.currentServingSerial;
    const newSessionStatus = session.status === 'SCHEDULED' ? 'ACTIVE' : session.status;
    const actualStartTime = session.actualStartTime ?? now;

    await tx
      .update(sessions)
      .set({
        currentServingSerial: newServingSerial,
        status: newSessionStatus,
        actualStartTime,
      })
      .where(eq(sessions.id, sessionId));

    // 5. Compute moving average including the newly completed patient
    const movingAverageMins = await computeMovingAverageConsultationTime(
      tx,
      sessionId,
      doctorBaseline,
    );

    // 6. Calculate estimated times for remaining waiting patients
    let currentPatientEstDuration = 0;
    if (nextPatient) {
      const nextWeight =
        (nextPatient.appointmentType && APPOINTMENT_TYPE_WEIGHTS[nextPatient.appointmentType]) || 1.0;
      currentPatientEstDuration = Math.max(
        MIN_CONSULTATION_MINS,
        Math.round(movingAverageMins * nextWeight),
      );
    }

    const waitingAppointments = remainingWaitingRows.map((r) => r.appointment);
    const calculatedEstimates = calculateEstimatedTimes(
      waitingAppointments,
      movingAverageMins,
      now,
      currentPatientEstDuration,
    );

    // Update each waiting patient's estimated consult time in database and check threshold alerts
    const alertsToTrigger: Array<() => Promise<any>> = [];

    for (const est of calculatedEstimates) {
      const row = remainingWaitingRows.find((r) => r.appointment.id === est.id);
      const oldEstimatedTime = row?.appointment.estimatedConsultTime ?? null;

      await tx
        .update(appointments)
        .set({
          estimatedConsultTime: est.estimatedConsultTime,
        })
        .where(eq(appointments.id, est.id));

      if (row && row.patientPhone) {
        alertsToTrigger.push(() =>
          checkAndDispatchTimeChangeAlert({
            appointmentId: est.id,
            serialNumber: row.appointment.serialNumber,
            recipientPhone: row.patientPhone,
            recipientName: row.patientName ?? 'Patient',
            chamberName: chamberName ?? 'Clinic Chamber',
            trackingToken: row.appointment.trackingToken,
            oldEstimatedTime,
            newEstimatedTime: est.estimatedConsultTime,
          })
        );
      }
    }

    // Trigger SMS alerts asynchronously (non-blocking for DB commit)
    Promise.allSettled(alertsToTrigger.map((fn) => fn())).catch((err) =>
      console.error('Failed dispatching time change alerts:', err)
    );

    // 7. Format waiting list output
    const updatedWaitingPatients = remainingWaitingRows.map((row) => {
      const est = calculatedEstimates.find((e) => e.id === row.appointment.id);
      return {
        id: row.appointment.id,
        serialNumber: row.appointment.serialNumber,
        appointmentType: row.appointment.appointmentType,
        status: row.appointment.status ?? 'WAITING',
        patientName: row.patientName,
        estimatedConsultTime: est?.estimatedConsultTime ?? null,
        estimatedDurationMins: est?.estimatedDurationMins ?? movingAverageMins,
      };
    });

    return {
      sessionId,
      sessionStatus: newSessionStatus ?? 'ACTIVE',
      currentServingSerial: newServingSerial ?? 0,
      movingAverageMins,
      completedPatient: completedPatientData,
      currentPatient: nextPatient
        ? {
            id: nextPatient.id,
            serialNumber: nextPatient.serialNumber,
            appointmentType: nextPatient.appointmentType,
            status: 'IN_CONSULTATION',
            consultationStartTime: now,
          }
        : null,
      waitingPatients: updatedWaitingPatients,
    };
  });
}

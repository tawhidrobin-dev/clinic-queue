import { NextResponse } from 'next/server';
import { eq, asc, and } from 'drizzle-orm';
import { db } from '@/src/db';
import {
  sessions,
  chambers,
  doctorProfiles,
  users,
  appointments,
  patients,
} from '@/src/db/schema';
import {
  APPOINTMENT_TYPE_WEIGHTS,
  MIN_CONSULTATION_MINS,
} from '@/src/lib/queue/constants';
import { sendSms } from '@/src/lib/notifications/sms';

interface RouteContext {
  params: { id: string } | Promise<{ id: string }>;
}

/**
 * POST /api/sessions/:id/set-start-time
 *
 * Triggered from Doctor's Phone when the doctor confirms their start time.
 * 1. Updates session start time and status.
 * 2. Forecasts exact estimated consultation times for all uploaded patient appointments.
 * 3. Dispatches initial batch SMS to every patient with their serial number,
 *    scheduled turn time, and personal live tracking link.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const params = await Promise.resolve(context.params);
    const sessionId = params.id;

    const body = await request.json();
    const { startTime, isStartingNow, delayMinutes = 0 } = body;

    const now = new Date();

    // 1. Fetch Session, Chamber, Doctor Info
    const sessionRows = await db
      .select({
        session: sessions,
        chamber: chambers,
        doctor: doctorProfiles,
        doctorUser: users,
      })
      .from(sessions)
      .leftJoin(chambers, eq(sessions.chamberId, chambers.id))
      .leftJoin(doctorProfiles, eq(chambers.doctorId, doctorProfiles.id))
      .leftJoin(users, eq(doctorProfiles.userId, users.id))
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (sessionRows.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const { session, chamber, doctor, doctorUser } = sessionRows[0];
    const doctorName = doctorUser?.fullName || 'Your Doctor';
    const chamberName = chamber?.chamberName || 'Clinic Chamber';
    const baselineMins = doctor?.avgConsultationMins ?? 12;

    // Determine target start timestamp
    let sessionStartTimestamp: Date;

    if (isStartingNow) {
      sessionStartTimestamp = new Date(now.getTime() + (delayMinutes || 0) * 60 * 1000);
    } else if (startTime) {
      // startTime format e.g. "18:30" or "18:30:00"
      const [hours, minutes] = startTime.split(':').map((v: string) => parseInt(v, 10));
      const scheduledDateStr = session.scheduledDate; // "YYYY-MM-DD"
      sessionStartTimestamp = new Date(scheduledDateStr);
      sessionStartTimestamp.setHours(hours, minutes, 0, 0);

      if (delayMinutes > 0) {
        sessionStartTimestamp = new Date(
          sessionStartTimestamp.getTime() + delayMinutes * 60 * 1000,
        );
      }
    } else {
      sessionStartTimestamp = now;
    }

    const formattedStartTimeStr = sessionStartTimestamp.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const isImmediatelyActive = sessionStartTimestamp.getTime() <= now.getTime() + 5 * 60 * 1000;
    const newStatus = isImmediatelyActive ? 'ACTIVE' : 'SCHEDULED';

    // 2. Update Session Record
    await db
      .update(sessions)
      .set({
        scheduledStartTime: `${String(sessionStartTimestamp.getHours()).padStart(2, '0')}:${String(
          sessionStartTimestamp.getMinutes(),
        ).padStart(2, '0')}:00`,
        status: newStatus,
        actualStartTime: isImmediatelyActive ? now : session.actualStartTime,
      })
      .where(eq(sessions.id, sessionId));

    // 3. Fetch All Waiting Appointments
    const waitingList = await db
      .select({
        appointment: appointments,
        patient: patients,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .where(
        and(
          eq(appointments.sessionId, sessionId),
          eq(appointments.status, 'WAITING'),
        ),
      )
      .orderBy(asc(appointments.serialNumber));

    if (waitingList.length === 0) {
      return NextResponse.json({
        success: true,
        message: `Start time set to ${formattedStartTimeStr}. No waiting appointments to notify.`,
        scheduledStartTime: formattedStartTimeStr,
        smsSentCount: 0,
      });
    }

    // 4. Calculate Turn Times & Prepare Batch SMS
    let currentAccumulatorMs = sessionStartTimestamp.getTime();
    const updatesAndAlerts = [];

    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    for (const item of waitingList) {
      const appt = item.appointment;
      const patientRecord = item.patient;

      const typeWeight =
        (appt.appointmentType && APPOINTMENT_TYPE_WEIGHTS[appt.appointmentType]) || 1.0;
      const durationMins = Math.max(
        MIN_CONSULTATION_MINS,
        Math.round(baselineMins * typeWeight),
      );

      const estimatedConsultTime = new Date(currentAccumulatorMs);
      currentAccumulatorMs += durationMins * 60 * 1000;

      const travelMins = appt.estimatedTravelMins || 25;
      const recommendedLeaveTime = new Date(
        estimatedConsultTime.getTime() - travelMins * 60 * 1000,
      );

      const estFormattedTime = estimatedConsultTime.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      const trackingUrl = `${appBaseUrl}/track/${appt.trackingToken}`;
      const patientName = patientRecord?.fullName || 'Patient';
      const patientPhone = patientRecord?.phoneNumber;

      const smsText = `Clinic Alert: ${doctorName} starts today at ${formattedStartTimeStr} (${chamberName}). Hello ${patientName}, your Serial is #${appt.serialNumber}. Est. turn: ${estFormattedTime}. Live track your queue: ${trackingUrl}`;

      updatesAndAlerts.push({
        appointmentId: appt.id,
        estimatedConsultTime,
        recommendedLeaveTime,
        patientPhone,
        smsText,
        serialNumber: appt.serialNumber,
        estFormattedTime,
      });
    }

    // 5. Update All Appointments in Database
    for (const item of updatesAndAlerts) {
      await db
        .update(appointments)
        .set({
          estimatedConsultTime: item.estimatedConsultTime,
          recommendedLeaveTime: item.recommendedLeaveTime,
        })
        .where(eq(appointments.id, item.appointmentId));
    }

    // 6. Batch Dispatch SMS Notifications
    let dispatchedCount = 0;
    const smsPromises = updatesAndAlerts.map(async (item) => {
      if (item.patientPhone) {
        const res = await sendSms({
          to: item.patientPhone,
          message: item.smsText,
          appointmentId: item.appointmentId,
        });
        if (res.success) dispatchedCount++;
      }
    });

    await Promise.allSettled(smsPromises);

    return NextResponse.json({
      success: true,
      message: `Start time set to ${formattedStartTimeStr}. Dispatched SMS notifications to ${updatesAndAlerts.length} patients.`,
      scheduledStartTime: formattedStartTimeStr,
      sessionStatus: newStatus,
      totalPatients: updatesAndAlerts.length,
      smsDispatched: updatesAndAlerts.length,
      queueForecast: updatesAndAlerts.map((u) => ({
        serialNumber: u.serialNumber,
        estimatedTime: u.estFormattedTime,
        phone: u.patientPhone,
      })),
    });
  } catch (error: any) {
    console.error('Error in set-start-time:', error);
    return NextResponse.json(
      { error: 'Failed to set start time and dispatch alerts', details: error.message },
      { status: 500 },
    );
  }
}

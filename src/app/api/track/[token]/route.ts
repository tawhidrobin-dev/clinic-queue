import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/src/db';
import {
  appointments,
  sessions,
  chambers,
  doctorProfiles,
  users,
  patients,
} from '@/src/db/schema';

interface RouteContext {
  params: { token: string } | Promise<{ token: string }>;
}

/**
 * GET /api/track/:token
 * Public endpoint for patient queue tracking (no authentication required).
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const params = await Promise.resolve(context.params);
    const token = params.token;

    if (!token) {
      return NextResponse.json({ error: 'Tracking token is required' }, { status: 400 });
    }

    const rows = await db
      .select({
        appointment: appointments,
        patient: patients,
        session: sessions,
        chamber: chambers,
        doctor: doctorProfiles,
        doctorUser: users,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(sessions, eq(appointments.sessionId, sessions.id))
      .leftJoin(chambers, eq(sessions.chamberId, chambers.id))
      .leftJoin(doctorProfiles, eq(chambers.doctorId, doctorProfiles.id))
      .leftJoin(users, eq(doctorProfiles.userId, users.id))
      .where(eq(appointments.trackingToken, token))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Appointment not found for this token' }, { status: 404 });
    }

    const data = rows[0];
    const now = new Date();

    let minutesUntilTurn: number | null = null;
    if (data.appointment.estimatedConsultTime) {
      const diffMs = new Date(data.appointment.estimatedConsultTime).getTime() - now.getTime();
      minutesUntilTurn = Math.max(0, Math.round(diffMs / (60 * 1000)));
    }

    const currentServing = data.session?.currentServingSerial ?? 0;
    const serial = data.appointment.serialNumber;
    const serialsAhead = Math.max(0, serial - currentServing - (data.appointment.status === 'IN_CONSULTATION' ? 0 : 1));

    return NextResponse.json({
      appointment: {
        id: data.appointment.id,
        serialNumber: data.appointment.serialNumber,
        appointmentType: data.appointment.appointmentType,
        status: data.appointment.status,
        estimatedConsultTime: data.appointment.estimatedConsultTime,
        consultationStartTime: data.appointment.consultationStartTime,
        estimatedTravelMins: data.appointment.estimatedTravelMins,
        recommendedLeaveTime: data.appointment.recommendedLeaveTime,
        trackingToken: data.appointment.trackingToken,
      },
      patient: {
        fullName: data.patient?.fullName,
        preferredTransport: data.patient?.preferredTransport,
      },
      session: {
        id: data.session?.id,
        status: data.session?.status,
        scheduledDate: data.session?.scheduledDate,
        scheduledStartTime: data.session?.scheduledStartTime,
        currentServingSerial: currentServing,
      },
      chamber: {
        chamberName: data.chamber?.chamberName,
        area: data.chamber?.area,
        address: data.chamber?.address,
      },
      doctor: {
        fullName: data.doctorUser?.fullName,
        specialty: data.doctor?.specialty,
      },
      queueMetrics: {
        serialsAhead,
        minutesUntilTurn,
        isCurrentlyServing: data.appointment.status === 'IN_CONSULTATION',
      },
    });
  } catch (error: any) {
    console.error('Error fetching tracking info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tracking data', details: error.message },
      { status: 500 },
    );
  }
}

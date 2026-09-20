import { NextResponse } from 'next/server';
import { eq, desc, asc, and } from 'drizzle-orm';
import { db } from '@/src/db';
import {
  sessions,
  chambers,
  doctorProfiles,
  users,
  appointments,
  patients,
} from '@/src/db/schema';
import { computeMovingAverageConsultationTime } from '@/src/lib/queue/engine';

interface RouteContext {
  params: { id: string } | Promise<{ id: string }>;
}

/**
 * GET /api/sessions/:id
 * Fetches full session details, doctor profile, active consult, queue, and completed list.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const params = await Promise.resolve(context.params);
    const sessionId = params.id;

    // 1. Fetch Session + Chamber + Doctor + User
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

    // 2. Fetch Active In-Consultation Patient
    const activeRows = await db
      .select({
        appointment: appointments,
        patient: patients,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .where(
        and(
          eq(appointments.sessionId, sessionId),
          eq(appointments.status, 'IN_CONSULTATION'),
        ),
      )
      .limit(1);

    // 3. Fetch Waiting Queue
    const waitingRows = await db
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

    // 4. Fetch Completed Patients
    const completedRows = await db
      .select({
        appointment: appointments,
        patient: patients,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .where(
        and(
          eq(appointments.sessionId, sessionId),
          eq(appointments.status, 'COMPLETED'),
        ),
      )
      .orderBy(desc(appointments.consultationEndTime))
      .limit(10);

    // 5. Compute Moving Average
    const movingAverageMins = await computeMovingAverageConsultationTime(
      db as any,
      sessionId,
      doctor?.avgConsultationMins ?? 10,
    );

    return NextResponse.json({
      session,
      chamber,
      doctor: doctor
        ? {
            ...doctor,
            fullName: doctorUser?.fullName,
            email: doctorUser?.email,
          }
        : null,
      movingAverageMins,
      activeConsultation: activeRows[0] || null,
      waitingQueue: waitingRows,
      completedList: completedRows,
    });
  } catch (error: any) {
    console.error('Error fetching session overview:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session', details: error.message },
      { status: 500 },
    );
  }
}

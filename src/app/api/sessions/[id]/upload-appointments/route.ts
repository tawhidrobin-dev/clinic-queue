import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { sessions, patients, appointments } from '@/src/db/schema';
import { parseAppointmentSpreadsheet, generateSampleCsv } from '@/src/lib/excel/parser';

interface RouteContext {
  params: { id: string } | Promise<{ id: string }>;
}

/**
 * GET /api/sessions/:id/upload-appointments
 * Downloads sample CSV template for assistant upload.
 */
export async function GET() {
  const csvContent = generateSampleCsv();
  return new Response(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="clinic_appointments_template.csv"',
    },
  });
}

/**
 * POST /api/sessions/:id/upload-appointments
 * Accepts multipart/form-data with an Excel (.xlsx, .xls) or CSV file.
 * Bulk creates patients and appointments under this session.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const params = await Promise.resolve(context.params);
    const sessionId = params.id;

    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const parsedRows = parseAppointmentSpreadsheet(buffer);

    if (parsedRows.length === 0) {
      return NextResponse.json({ error: 'No valid rows found in file' }, { status: 400 });
    }

    // Insert patients and appointments atomically
    const importedAppointments = await db.transaction(async (tx) => {
      const created = [];

      for (const row of parsedRows) {
        // 1. Create Patient
        const [patient] = await tx
          .insert(patients)
          .values({
            fullName: row.fullName,
            phoneNumber: row.phoneNumber,
            age: row.age,
            gender: row.gender,
            preferredTransport: row.preferredTransport || 'CAR',
            homeLatitude: row.homeLatitude,
            homeLongitude: row.homeLongitude,
          })
          .returning();

        // 2. Generate unique tracking token
        const trackingToken = crypto.randomBytes(16).toString('hex');

        // 3. Insert Appointment (upsert on unique (session_id, serial_number))
        const [appt] = await tx
          .insert(appointments)
          .values({
            sessionId,
            patientId: patient.id,
            serialNumber: row.serialNumber,
            appointmentType: row.appointmentType,
            status: 'WAITING',
            trackingToken,
            estimatedTravelMins: row.estimatedTravelMins,
          })
          .onConflictDoUpdate({
            target: [appointments.sessionId, appointments.serialNumber],
            set: {
              patientId: patient.id,
              appointmentType: row.appointmentType,
              status: 'WAITING',
              estimatedTravelMins: row.estimatedTravelMins,
            },
          })
          .returning();

        created.push({
          id: appt.id,
          serialNumber: appt.serialNumber,
          patientName: row.fullName,
          phoneNumber: row.phoneNumber,
          appointmentType: appt.appointmentType,
          trackingToken: appt.trackingToken,
        });
      }

      return created;
    });

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${importedAppointments.length} appointments from file`,
      count: importedAppointments.length,
      appointments: importedAppointments,
    });
  } catch (error: any) {
    console.error('Error importing appointments spreadsheet:', error);
    return NextResponse.json(
      { error: 'Failed to parse and import appointments', details: error.message },
      { status: 500 },
    );
  }
}

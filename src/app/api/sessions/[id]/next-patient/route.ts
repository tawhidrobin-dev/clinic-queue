import { NextResponse } from 'next/server';
import { advanceToNextPatient } from '@/src/lib/queue/engine';

interface RouteContext {
  params: { id: string } | Promise<{ id: string }>;
}

/**
 * POST /api/sessions/:id/next-patient
 *
 * Triggered by assistant or doctor to call the next patient in the queue:
 * 1. Completes previous in-consultation patient (if any) and calculates duration.
 * 2. Promotes next waiting patient to IN_CONSULTATION.
 * 3. Re-computes moving average consultation duration for the session.
 * 4. Applies appointment type weight multipliers to forecast ETA for all waiting patients.
 * 5. Returns the updated queue and serial states.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const params = await Promise.resolve(context.params);
    const sessionId = params.id;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 },
      );
    }

    // Basic UUID validation
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      return NextResponse.json(
        { error: 'Invalid UUID format for session ID' },
        { status: 400 },
      );
    }

    const result = await advanceToNextPatient(sessionId);

    return NextResponse.json(
      {
        success: true,
        message: result.currentPatient
          ? `Now serving serial #${result.currentPatient.serialNumber}`
          : 'No more waiting patients in this session',
        data: result,
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error('Error advancing queue to next patient:', error);

    const message = error?.message || 'An unexpected error occurred';

    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    if (message.includes('Cannot advance')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: 'Failed to advance patient queue',
        details: process.env.NODE_ENV === 'development' ? message : undefined,
      },
      { status: 500 },
    );
  }
}

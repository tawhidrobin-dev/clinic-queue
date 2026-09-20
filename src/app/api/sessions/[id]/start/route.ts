import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { sessions } from '@/src/db/schema';

interface RouteContext {
  params: { id: string } | Promise<{ id: string }>;
}

/**
 * POST /api/sessions/:id/start
 * Starts a SCHEDULED or PAUSED session.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const params = await Promise.resolve(context.params);
    const sessionId = params.id;

    const [existing] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
      return NextResponse.json(
        { error: `Cannot start a session that is ${existing.status}` },
        { status: 400 },
      );
    }

    const now = new Date();
    const updated = await db
      .update(sessions)
      .set({
        status: 'ACTIVE',
        actualStartTime: existing.actualStartTime ?? now,
      })
      .where(eq(sessions.id, sessionId))
      .returning();

    return NextResponse.json({
      success: true,
      message: 'Session is now ACTIVE',
      session: updated[0],
    });
  } catch (error: any) {
    console.error('Error starting session:', error);
    return NextResponse.json(
      { error: 'Failed to start session', details: error.message },
      { status: 500 },
    );
  }
}

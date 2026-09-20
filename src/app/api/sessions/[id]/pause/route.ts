import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { sessions } from '@/src/db/schema';

interface RouteContext {
  params: { id: string } | Promise<{ id: string }>;
}

/**
 * POST /api/sessions/:id/pause
 * Toggles a session between PAUSED and ACTIVE.
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

    if (existing.status !== 'ACTIVE' && existing.status !== 'PAUSED') {
      return NextResponse.json(
        { error: `Cannot pause/resume a session in ${existing.status} status` },
        { status: 400 },
      );
    }

    const nextStatus = existing.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';

    const updated = await db
      .update(sessions)
      .set({
        status: nextStatus,
      })
      .where(eq(sessions.id, sessionId))
      .returning();

    return NextResponse.json({
      success: true,
      message: `Session is now ${nextStatus}`,
      session: updated[0],
    });
  } catch (error: any) {
    console.error('Error toggling pause on session:', error);
    return NextResponse.json(
      { error: 'Failed to toggle pause on session', details: error.message },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady, isDbConfigured } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    if (!isDbConfigured()) {
      return NextResponse.json({
        success: false,
        dbConfigured: false,
      });
    }

    const sql = await ensureDbReady();
    if (!sql) {
      return NextResponse.json(
        { success: false, error: 'Database unavailable' },
        { status: 500 }
      );
    }

    const sessionRows = await sql`
      SELECT id, user_id, title, created_at, updated_at
      FROM chat_sessions
      WHERE id = ${sessionId}
      LIMIT 1;
    `;

    if (sessionRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    const messageRows = await sql`
      SELECT id, role, content, sources, suggested_questions, created_at
      FROM chat_messages
      WHERE session_id = ${sessionId}
      ORDER BY created_at ASC;
    `;

    const s = sessionRows[0];
    const session = {
      id: s.id,
      userId: s.user_id,
      title: s.title,
      createdAt: Number(s.created_at),
      updatedAt: Number(s.updated_at),
      messages: messageRows.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sources: m.sources || [],
        suggestedQuestions: m.suggested_questions || [],
        timestamp: Number(m.created_at),
      })),
    };

    return NextResponse.json({ success: true, dbConfigured: true, session });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch session' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;
    const body = await req.json().catch(() => ({}));
    const newTitle = (body.title || '').trim();

    if (!sessionId || !newTitle) {
      return NextResponse.json(
        { success: false, error: 'Session ID and new title are required' },
        { status: 400 }
      );
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ success: false, dbConfigured: false });
    }

    const sql = await ensureDbReady();
    if (!sql) {
      return NextResponse.json(
        { success: false, error: 'Database unavailable' },
        { status: 500 }
      );
    }

    const now = Date.now();
    await sql`
      UPDATE chat_sessions
      SET title = ${newTitle}, updated_at = ${now}
      WHERE id = ${sessionId};
    `;

    return NextResponse.json({ success: true, title: newTitle, updatedAt: now });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to rename session' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ success: false, dbConfigured: false });
    }

    const sql = await ensureDbReady();
    if (!sql) {
      return NextResponse.json(
        { success: false, error: 'Database unavailable' },
        { status: 500 }
      );
    }

    // Deleting from chat_sessions automatically cascades to chat_messages via FOREIGN KEY ON DELETE CASCADE
    await sql`
      DELETE FROM chat_sessions WHERE id = ${sessionId};
    `;

    return NextResponse.json({ success: true, message: 'Session deleted successfully' });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to delete session' },
      { status: 500 }
    );
  }
}

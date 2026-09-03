import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady, isDbConfigured } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = (searchParams.get('userId') || '').trim().toLowerCase();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId parameter is required' },
        { status: 400 }
      );
    }

    if (!isDbConfigured()) {
      return NextResponse.json({
        success: false,
        dbConfigured: false,
        message: 'Neon DB not configured.',
      });
    }

    const sql = await ensureDbReady();
    if (!sql) {
      return NextResponse.json(
        { success: false, error: 'Failed to connect to database' },
        { status: 500 }
      );
    }

    // 1. Fetch sessions for user
    const sessionRows = await sql`
      SELECT id, user_id, title, created_at, updated_at
      FROM chat_sessions
      WHERE user_id = ${userId}
      ORDER BY updated_at DESC;
    `;

    if (sessionRows.length === 0) {
      return NextResponse.json({ success: true, dbConfigured: true, sessions: [] });
    }

    const sessionIds = sessionRows.map(r => r.id as string);

    // 2. Fetch all messages for these sessions
    const messageRows = await sql`
      SELECT id, session_id, role, content, sources, suggested_questions, created_at
      FROM chat_messages
      WHERE session_id = ANY(${sessionIds})
      ORDER BY created_at ASC;
    `;

    // Group messages by session_id
    const messagesBySession = new Map<string, any[]>();
    for (const msg of messageRows) {
      const sid = msg.session_id as string;
      if (!messagesBySession.has(sid)) {
        messagesBySession.set(sid, []);
      }
      messagesBySession.get(sid)!.push({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        sources: msg.sources || [],
        suggestedQuestions: msg.suggested_questions || [],
        timestamp: Number(msg.created_at),
      });
    }

    const sessions = sessionRows.map(r => ({
      id: r.id,
      userId: r.user_id,
      title: r.title,
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at),
      messages: messagesBySession.get(r.id as string) || [],
    }));

    return NextResponse.json({ success: true, dbConfigured: true, sessions });
  } catch (err: any) {
    console.error('Fetch Chats Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch chats' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { id, userId, title, createdAt, updatedAt, messages } = body;

    if (!id || !userId) {
      return NextResponse.json(
        { success: false, error: 'id and userId are required' },
        { status: 400 }
      );
    }

    if (!isDbConfigured()) {
      return NextResponse.json({
        success: false,
        dbConfigured: false,
        message: 'Neon DB not configured.',
      });
    }

    const sql = await ensureDbReady();
    if (!sql) {
      return NextResponse.json(
        { success: false, error: 'Failed to connect to database' },
        { status: 500 }
      );
    }

    const safeUserId = userId.trim().toLowerCase();
    const safeTitle = (title || 'New Conversation').trim();
    const now = Date.now();
    const createdTimestamp = createdAt ? Number(createdAt) : now;
    const updatedTimestamp = updatedAt ? Number(updatedAt) : now;

    // Ensure user exists in users table first
    const userExists = await sql`
      SELECT username FROM users WHERE username = ${safeUserId} LIMIT 1;
    `;
    if (userExists.length === 0) {
      // Auto-create user record if not present
      await sql`
        INSERT INTO users (username, password_hash)
        VALUES (${safeUserId}, 'external_account')
        ON CONFLICT (username) DO NOTHING;
      `;
    }

    // Upsert session
    await sql`
      INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at)
      VALUES (${id}, ${safeUserId}, ${safeTitle}, ${createdTimestamp}, ${updatedTimestamp})
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        updated_at = EXCLUDED.updated_at;
    `;

    // Upsert messages if provided
    if (Array.isArray(messages) && messages.length > 0) {
      for (const msg of messages) {
        const msgId = msg.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const msgRole = msg.role || 'user';
        const msgContent = msg.content || '';
        const msgSources = JSON.stringify(msg.sources || []);
        const msgQuestions = JSON.stringify(msg.suggestedQuestions || []);
        const msgTimestamp = msg.timestamp ? Number(msg.timestamp) : now;

        await sql`
          INSERT INTO chat_messages (id, session_id, role, content, sources, suggested_questions, created_at)
          VALUES (${msgId}, ${id}, ${msgRole}, ${msgContent}, ${msgSources}::jsonb, ${msgQuestions}::jsonb, ${msgTimestamp})
          ON CONFLICT (id) DO UPDATE SET
            content = EXCLUDED.content,
            sources = EXCLUDED.sources,
            suggested_questions = EXCLUDED.suggested_questions;
        `;
      }
    }

    return NextResponse.json({
      success: true,
      dbConfigured: true,
      session: {
        id,
        userId: safeUserId,
        title: safeTitle,
        createdAt: createdTimestamp,
        updatedAt: updatedTimestamp,
        messages: messages || [],
      },
    });
  } catch (err: any) {
    console.error('Save Chat Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to save chat' },
      { status: 500 }
    );
  }
}

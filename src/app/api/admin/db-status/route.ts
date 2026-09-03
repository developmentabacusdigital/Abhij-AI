import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady, isDbConfigured } from '@/lib/db';
import { checkAdminPasscode } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const adminKey = req.headers.get('x-admin-key') || '';
  if (!checkAdminPasscode(adminKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isDbConfigured()) {
    return NextResponse.json({
      configured: false,
      driver: 'localStorage (Browser Fallback)',
      message: 'DATABASE_URL is not configured in your environment.',
    });
  }

  try {
    const sql = await ensureDbReady();
    if (!sql) {
      return NextResponse.json({
        configured: true,
        connected: false,
        error: 'Database URL present but connection failed.',
      });
    }

    const [userCountRes, sessionCountRes, messageCountRes, docCountRes] = await Promise.all([
      sql`SELECT COUNT(*)::int as count FROM users;`,
      sql`SELECT COUNT(*)::int as count FROM chat_sessions;`,
      sql`SELECT COUNT(*)::int as count FROM chat_messages;`,
      sql`SELECT COUNT(*)::int as count FROM knowledge_documents;`,
    ]);

    return NextResponse.json({
      configured: true,
      connected: true,
      driver: 'Neon Serverless PostgreSQL',
      stats: {
        users: userCountRes[0]?.count || 0,
        sessions: sessionCountRes[0]?.count || 0,
        messages: messageCountRes[0]?.count || 0,
        documents: docCountRes[0]?.count || 0,
      },
    });
  } catch (err: any) {
    return NextResponse.json({
      configured: true,
      connected: false,
      error: err.message || 'Error querying database',
    });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady, isDbConfigured } from '@/lib/db';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + '_abhij_salt').digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const username = (body.username || '').trim().toLowerCase();
    const password = (body.password || '').trim();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Please enter both username and password.' },
        { status: 400 }
      );
    }

    if (!isDbConfigured()) {
      return NextResponse.json({
        success: false,
        dbConfigured: false,
        message: 'Neon DB not configured. Using client-side storage.',
      });
    }

    const sql = await ensureDbReady();
    if (!sql) {
      return NextResponse.json(
        { success: false, error: 'Failed to connect to database' },
        { status: 500 }
      );
    }

    const rows = await sql`
      SELECT id, username, password_hash, created_at
      FROM users
      WHERE username = ${username}
      LIMIT 1;
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'User not found. Please create an account.' },
        { status: 401 }
      );
    }

    const user = rows[0];
    const passwordHash = hashPassword(password);

    if (user.password_hash !== passwordHash) {
      return NextResponse.json(
        { success: false, error: 'Incorrect password. Please try again.' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      dbConfigured: true,
      user: {
        username: user.username,
        createdAt: new Date(user.created_at).getTime(),
      },
    });
  } catch (err: any) {
    console.error('Login Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Login failed' },
      { status: 500 }
    );
  }
}

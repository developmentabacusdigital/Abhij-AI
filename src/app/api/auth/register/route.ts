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

    if (!username || username.length < 3) {
      return NextResponse.json(
        { success: false, error: 'Username must be at least 3 characters.' },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return NextResponse.json(
        { success: false, error: 'Username can only contain letters, numbers, hyphens, and underscores.' },
        { status: 400 }
      );
    }

    if (!password || password.length < 4) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 4 characters.' },
        { status: 400 }
      );
    }

    // Check if Neon DB is configured
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

    // Check if username already exists
    const existing = await sql`
      SELECT username FROM users WHERE username = ${username} LIMIT 1;
    `;

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Username already taken. Please choose another.' },
        { status: 409 }
      );
    }

    const passwordHash = hashPassword(password);
    const result = await sql`
      INSERT INTO users (username, password_hash)
      VALUES (${username}, ${passwordHash})
      RETURNING id, username, created_at;
    `;

    const newUser = result[0];

    return NextResponse.json({
      success: true,
      dbConfigured: true,
      user: {
        username: newUser.username,
        createdAt: new Date(newUser.created_at).getTime(),
      },
    });
  } catch (err: any) {
    console.error('Registration Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Registration failed' },
      { status: 500 }
    );
  }
}

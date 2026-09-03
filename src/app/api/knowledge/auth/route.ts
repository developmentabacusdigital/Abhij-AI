import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPasscode } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const headerKey = req.headers.get('x-admin-key') || '';
    const bodyKey = body.passcode || '';
    const providedKey = headerKey || bodyKey;

    if (!checkAdminPasscode(providedKey)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Invalid admin passcode' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Admin credentials verified successfully',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

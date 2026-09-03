import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');
const PUBLIC_MEDIA_DIR = path.join(process.cwd(), 'public', 'knowledge-media');

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileParam = searchParams.get('file');
    const docParam = searchParams.get('doc');
    const imgParam = searchParams.get('img');

    let targetFilePath = '';

    if (docParam && imgParam) {
      const safeDoc = path.basename(docParam).replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeImg = path.basename(imgParam);
      const candidates = [
        path.join(PUBLIC_MEDIA_DIR, safeDoc, safeImg),
        path.join(os.tmpdir(), 'knowledge-media', safeDoc, safeImg),
      ];
      for (const p of candidates) {
        if (fs.existsSync(p) && fs.statSync(p).isFile()) {
          targetFilePath = p;
          break;
        }
      }
    } else if (fileParam) {
      const cleanFile = fileParam.replace(/^\.?\/?/, '');
      const candidatePaths = [
        path.join(KNOWLEDGE_DIR, cleanFile),
        path.join(KNOWLEDGE_DIR, 'images', cleanFile),
        path.join(PUBLIC_MEDIA_DIR, cleanFile),
        path.join(os.tmpdir(), 'knowledge-media', cleanFile),
      ];

      for (const p of candidatePaths) {
        if (fs.existsSync(p) && fs.statSync(p).isFile()) {
          targetFilePath = p;
          break;
        }
      }
    }

    if (!targetFilePath || !fs.existsSync(targetFilePath)) {
      return new NextResponse('Media not found', { status: 404 });
    }

    // Safety check: ensure file path is inside the project
    const resolved = path.resolve(targetFilePath);
    if (!resolved.startsWith(process.cwd())) {
      return new NextResponse('Access denied', { status: 403 });
    }

    const ext = path.extname(targetFilePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const fileBuffer = fs.readFileSync(targetFilePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch (err: any) {
    console.error('Media API Error:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

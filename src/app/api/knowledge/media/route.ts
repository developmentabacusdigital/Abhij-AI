import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import mammoth from 'mammoth';

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

/**
 * On-demand DOCX image extractor to ensure media is available even after cold starts
 */
async function extractDocxImagesIfNeeded(docFilename: string, safeDocName: string): Promise<void> {
  const possibleDocPaths = [
    path.join(KNOWLEDGE_DIR, docFilename),
    path.join(os.tmpdir(), 'knowledge', docFilename),
    path.join(KNOWLEDGE_DIR, path.basename(docFilename)),
    path.join(os.tmpdir(), 'knowledge', path.basename(docFilename)),
  ];

  let docPath = '';
  for (const p of possibleDocPaths) {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      docPath = p;
      break;
    }
  }

  if (!docPath || !docPath.toLowerCase().endsWith('.docx')) {
    return;
  }

  const targetDir = path.join(PUBLIC_MEDIA_DIR, safeDocName);
  const tmpTargetDir = path.join(os.tmpdir(), 'knowledge-media', safeDocName);

  try {
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  } catch {}
  try {
    if (!fs.existsSync(tmpTargetDir)) fs.mkdirSync(tmpTargetDir, { recursive: true });
  } catch {}

  let imageIndex = 0;
  const options = {
    convertImage: mammoth.images.imgElement(async (element: any) => {
      try {
        imageIndex++;
        const rawExt = element.contentType ? element.contentType.split('/')[1] : 'png';
        const safeExt = rawExt === 'jpeg' ? 'jpg' : rawExt;
        const imageName = `image_${imageIndex}.${safeExt}`;
        const imageBuffer = await element.read();

        try {
          fs.writeFileSync(path.join(targetDir, imageName), imageBuffer);
        } catch {}
        try {
          fs.writeFileSync(path.join(tmpTargetDir, imageName), imageBuffer);
        } catch {}

        return { src: '' };
      } catch (err) {
        console.error('Error during on-demand docx image extraction:', err);
        return { src: '' };
      }
    }),
  };

  try {
    await mammoth.convertToMarkdown({ path: docPath }, options);
  } catch (err) {
    console.error(`Failed on-demand extraction for ${docPath}:`, err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let fileParam = searchParams.get('file');
    let docParam = searchParams.get('doc');
    let imgParam = searchParams.get('img');

    // Handle nested query string passed inside file param (e.g. /api/knowledge/media?file=doc%3D...%26img%3D...)
    if (fileParam && (fileParam.includes('doc=') || fileParam.includes('img='))) {
      try {
        const decoded = decodeURIComponent(fileParam);
        const subParams = new URLSearchParams(decoded.startsWith('?') ? decoded.slice(1) : decoded);
        if (subParams.get('doc')) docParam = subParams.get('doc');
        if (subParams.get('img')) imgParam = subParams.get('img');
      } catch {}
    }

    // Handle alt-text pattern: "Figure 10 in Abacus Framer Site Document.docx"
    if (fileParam && !docParam && !imgParam) {
      const figMatch = fileParam.match(/Figure\s+(\d+)\s+in\s+(.+)/i);
      if (figMatch) {
        const figureIndex = figMatch[1];
        docParam = figMatch[2].trim();
        imgParam = `image_${figureIndex}.png`;
      }
    }

    let targetFilePath = '';

    if (docParam && imgParam) {
      const ext = path.extname(docParam).toLowerCase();
      const nameWithoutExt = path.basename(docParam, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
      const nameWithExt = path.basename(docParam).replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeImg = path.basename(imgParam);

      const candidates = [
        path.join(PUBLIC_MEDIA_DIR, nameWithoutExt, safeImg),
        path.join(PUBLIC_MEDIA_DIR, nameWithExt, safeImg),
        path.join(os.tmpdir(), 'knowledge-media', nameWithoutExt, safeImg),
        path.join(os.tmpdir(), 'knowledge-media', nameWithExt, safeImg),
      ];

      for (const p of candidates) {
        if (fs.existsSync(p) && fs.statSync(p).isFile()) {
          targetFilePath = p;
          break;
        }
      }

      // If not yet on disk, extract on-demand from the DOCX
      if (!targetFilePath && ext === '.docx') {
        await extractDocxImagesIfNeeded(docParam, nameWithoutExt);
        for (const p of candidates) {
          if (fs.existsSync(p) && fs.statSync(p).isFile()) {
            targetFilePath = p;
            break;
          }
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

      // If still not found, search subfolders in public/knowledge-media and tmp
      if (!targetFilePath) {
        const baseName = path.basename(cleanFile);
        const searchDirs = [
          PUBLIC_MEDIA_DIR,
          path.join(os.tmpdir(), 'knowledge-media'),
        ];

        for (const dir of searchDirs) {
          if (fs.existsSync(dir)) {
            try {
              const subdirs = fs.readdirSync(dir);
              for (const sub of subdirs) {
                const subPath = path.join(dir, sub, baseName);
                if (fs.existsSync(subPath) && fs.statSync(subPath).isFile()) {
                  targetFilePath = subPath;
                  break;
                }
              }
            } catch {}
          }
          if (targetFilePath) break;
        }
      }
    }

    if (!targetFilePath || !fs.existsSync(targetFilePath)) {
      return new NextResponse('Media not found', { status: 404 });
    }

    // Safety check: ensure file path is inside project cwd or system tmpdir
    const resolved = path.resolve(targetFilePath);
    const cwdResolved = path.resolve(process.cwd());
    const tmpResolved = path.resolve(os.tmpdir());

    const isAllowed =
      resolved.startsWith(cwdResolved) ||
      resolved.startsWith(tmpResolved);

    if (!isAllowed) {
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

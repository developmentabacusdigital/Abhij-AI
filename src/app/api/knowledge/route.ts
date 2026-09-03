import { NextRequest, NextResponse } from 'next/server';
import {
  getAllKnowledgeDocuments,
  saveKnowledgeDocument,
  deleteKnowledgeDocument,
  isSafeFilename,
} from '@/lib/knowledge';

import { checkAdminPasscode } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function verifyAdminAuth(req: NextRequest): boolean {
  const providedKey = req.headers.get('x-admin-key') || req.nextUrl.searchParams.get('key') || '';
  return checkAdminPasscode(providedKey);
}

export async function GET() {
  try {
    const docs = await getAllKnowledgeDocuments();
    return NextResponse.json({
      documents: docs.map(d => ({
        filename: d.filename,
        filetype: d.filetype,
        title: d.title,
        size: d.size,
        sectionsCount: d.sectionsCount,
        content: d.content,
      })),
      totalDocs: docs.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to read knowledge base documents' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!verifyAdminAuth(req)) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing admin passcode' },
      { status: 401 }
    );
  }

  try {
    const contentType = req.headers.get('content-type') || '';

    // Handle Multipart Form Data (File Uploads)
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json(
          { error: 'No file provided in form data' },
          { status: 400 }
        );
      }

      const filename = file.name;
      if (!isSafeFilename(filename)) {
        return NextResponse.json(
          { error: 'Unsupported or invalid file format. Supported: .md, .markdown, .docx, .doc, .txt' },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await saveKnowledgeDocument(filename, buffer);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to save file' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `File ${filename} uploaded successfully`,
        filename,
      });
    }

    // Handle JSON Payload (Direct Markdown Creation / Editing)
    if (contentType.includes('application/json')) {
      const body = await req.json();
      let { filename, content } = body;

      if (!filename || typeof filename !== 'string') {
        return NextResponse.json(
          { error: 'Filename is required' },
          { status: 400 }
        );
      }

      // Ensure proper extension
      if (!filename.endsWith('.md') && !filename.endsWith('.markdown') && !filename.endsWith('.txt')) {
        filename = `${filename}.md`;
      }

      if (!isSafeFilename(filename)) {
        return NextResponse.json(
          { error: 'Invalid filename' },
          { status: 400 }
        );
      }

      const result = await saveKnowledgeDocument(filename, content || '');
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to save document' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Document ${filename} saved successfully`,
        filename,
      });
    }

    return NextResponse.json(
      { error: 'Unsupported Content-Type. Expected multipart/form-data or application/json' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('API Knowledge POST Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal error saving knowledge document' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!verifyAdminAuth(req)) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing admin passcode' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const filename = searchParams.get('file');

    if (!filename) {
      return NextResponse.json(
        { error: 'Filename parameter (?file=...) is required' },
        { status: 400 }
      );
    }

    if (!isSafeFilename(filename)) {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      );
    }

    const result = await deleteKnowledgeDocument(filename);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to delete file' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `File ${filename} deleted successfully`,
      filename,
    });
  } catch (error: any) {
    console.error('API Knowledge DELETE Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal error deleting knowledge document' },
      { status: 500 }
    );
  }
}

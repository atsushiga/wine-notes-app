import { NextRequest, NextResponse } from 'next/server';
import { storage, BUCKET } from '@/lib/gcs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';



interface UploadBody {
  filename: string;
  contentType: string;
}

interface UploadUrlResponse {
  putUrl: string;
  getUrl: string;
  key: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as UploadBody;
    const originalName = body?.filename ?? 'image.jpg';
    const ext = originalName.split('.').pop() || 'bin';
    const safeFilename = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;
    const contentType = body?.contentType ?? 'application/octet-stream';

    const now = new Date();
    const key = `uploads/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${safeFilename}`;

    const file = storage.bucket(BUCKET).file(key);

    // 署名付き PUT URL（10分）
    const [putUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 10 * 60 * 1000,
      contentType,
    });

    // プロキシ経由 GET URL
    // Use relative path to avoid dependency on PUBLIC_BASE_URL or ngrok status for preview
    const getUrl = `/api/images/${key}`;

    const payload: UploadUrlResponse = { putUrl, getUrl, key };
    return NextResponse.json(payload, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('upload-url error', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { storage, BUCKET } from '@/lib/gcs';
import { isAuthenticationRequiredError, requireAuthenticatedUser } from '@/lib/serverAuth';
import { checkAndRecordUserUsage, isUsageLimitError, usageLimitResponseMessage } from '@/lib/usageLimits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';



interface UploadBody {
  filename: string;
  contentType: string;
  size?: number;
}

interface UploadUrlResponse {
  putUrl: string;
  getUrl: string;
  key: string;
}

const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const body = (await req.json()) as UploadBody;
    const originalName = body?.filename ?? 'image.jpg';
    const ext = originalName.split('.').pop() || 'bin';
    const safeFilename = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;
    const contentType = body?.contentType ?? 'application/octet-stream';
    const size = Number(body?.size ?? 0);

    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 });
    }

    if (!Number.isFinite(size) || size <= 0 || size > MAX_IMAGE_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'Image size exceeds the upload limit' }, { status: 413 });
    }

    await checkAndRecordUserUsage(user.id, 'image_upload', {
      metadata: { size, contentType },
    });

    const now = new Date();
    const key = `uploads/${user.id}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${safeFilename}`;

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
    if (isAuthenticationRequiredError(err)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (isUsageLimitError(err)) {
      return NextResponse.json({ error: usageLimitResponseMessage(err) }, { status: 429 });
    }

    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('upload-url error', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

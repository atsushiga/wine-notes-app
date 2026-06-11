import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { storage, BUCKET } from '@/lib/gcs';
import { isAuthenticationRequiredError, requireAuthenticatedUser } from '@/lib/serverAuth';
import { checkAndRecordUserUsage, isUsageLimitError, usageLimitResponseMessage } from '@/lib/usageLimits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface UploadResponse {
  getUrl: string;
  key: string;
}

const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function extensionFor(filename: string, contentType: string): string {
  const rawExtension = filename.split('.').pop();
  if (rawExtension && rawExtension !== filename) {
    return rawExtension.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  }

  switch (contentType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return 'bin';
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const formData = await req.formData();
    const file = formData.get('file');
    const requestedFilename = String(formData.get('filename') ?? 'image.jpg');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    const contentType = file.type || 'application/octet-stream';
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 });
    }

    if (file.size <= 0 || file.size > MAX_IMAGE_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'Image size exceeds the upload limit' }, { status: 413 });
    }

    await checkAndRecordUserUsage(user.id, 'image_upload', {
      metadata: { size: file.size, contentType },
    });

    const extension = extensionFor(requestedFilename, contentType);
    const safeFilename = `${Date.now()}_${randomUUID()}.${extension}`;
    const now = new Date();
    const key = `uploads/${user.id}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${safeFilename}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await storage.bucket(BUCKET).file(key).save(buffer, {
      resumable: false,
      metadata: {
        contentType,
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });

    const payload: UploadResponse = {
      getUrl: `/api/images/${key}`,
      key,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err: unknown) {
    if (isAuthenticationRequiredError(err)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (isUsageLimitError(err)) {
      return NextResponse.json({ error: usageLimitResponseMessage(err) }, { status: 429 });
    }

    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('upload error', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

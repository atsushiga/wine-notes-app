import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { storage, BUCKET } from '@/lib/gcs';
import { isAuthenticationRequiredError, requireAuthenticatedUser } from '@/lib/serverAuth';
import { checkAndRecordUserUsage, isUsageLimitError, usageLimitResponseMessage } from '@/lib/usageLimits';
import {
  extensionForImageUpload,
  MAX_IMAGE_UPLOAD_BYTES,
  normalizeImageUploadContentType,
} from '@/lib/imageUploadValidation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface UploadResponse {
  getUrl: string;
  key: string;
}

const RESUMABLE_UPLOAD_THRESHOLD_BYTES = 1024 * 1024;
const MAX_STORAGE_UPLOAD_ATTEMPTS = 3;

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const formData = await req.formData();
    const file = formData.get('file');
    const requestedFilename = String(formData.get('filename') ?? 'image.jpg');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    const contentType = normalizeImageUploadContentType(requestedFilename, file.type);
    if (!contentType) {
      return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 });
    }

    if (file.size <= 0 || file.size > MAX_IMAGE_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'Image size exceeds the upload limit' }, { status: 413 });
    }

    await checkAndRecordUserUsage(user.id, 'image_upload', {
      metadata: { size: file.size, contentType },
    });

    const extension = extensionForImageUpload(requestedFilename, contentType);
    const safeFilename = `${Date.now()}_${randomUUID()}.${extension}`;
    const now = new Date();
    const key = `uploads/${user.id}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${safeFilename}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await saveImageBufferWithRetry(key, buffer, contentType);

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

async function saveImageBufferWithRetry(key: string, buffer: Buffer, contentType: string) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_STORAGE_UPLOAD_ATTEMPTS; attempt += 1) {
    try {
      await storage.bucket(BUCKET).file(key).save(buffer, {
        resumable: shouldUseResumableUpload(buffer, attempt),
        metadata: {
          contentType,
          cacheControl: 'public, max-age=31536000, immutable',
        },
      });
      return;
    } catch (error) {
      lastError = error;
      if (attempt >= MAX_STORAGE_UPLOAD_ATTEMPTS || !isRetryableStorageUploadError(error)) {
        throw error;
      }

      console.warn('GCS upload retrying after transient error', {
        attempt,
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      await wait(250 * (2 ** (attempt - 1)));
    }
  }

  throw lastError;
}

function shouldUseResumableUpload(buffer: Buffer, attempt: number) {
  return buffer.byteLength >= RESUMABLE_UPLOAD_THRESHOLD_BYTES || attempt > 1;
}

function isRetryableStorageUploadError(error: unknown) {
  const code = getErrorProperty(error, 'code');
  const status = Number(getErrorProperty(error, 'status') ?? getErrorProperty(error, 'statusCode'));
  const message = error instanceof Error ? error.message : String(error);

  return (
    code === 'EPIPE' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'EAI_AGAIN' ||
    status === 408 ||
    status === 429 ||
    (status >= 500 && status < 600) ||
    /EPIPE|ECONNRESET|ETIMEDOUT|socket hang up|network timeout/i.test(message)
  );
}

function getErrorProperty(error: unknown, key: string) {
  if (!error || typeof error !== 'object' || !(key in error)) return undefined;
  return (error as Record<string, unknown>)[key];
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

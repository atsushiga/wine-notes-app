import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { storage, BUCKET } from '@/lib/gcs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface UploadResponse {
  getUrl: string;
  key: string;
}

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
    const formData = await req.formData();
    const file = formData.get('file');
    const requestedFilename = String(formData.get('filename') ?? 'image.jpg');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    const contentType = file.type || 'application/octet-stream';
    const extension = extensionFor(requestedFilename, contentType);
    const safeFilename = `${Date.now()}_${randomUUID()}.${extension}`;
    const now = new Date();
    const key = `uploads/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${safeFilename}`;
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
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('upload error', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

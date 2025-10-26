import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});
const BUCKET = process.env.GCS_BUCKET_NAME!;

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
    const filename = body?.filename ?? 'upload.bin';
    const contentType = body?.contentType ?? 'application/octet-stream';

    const now = new Date();
    const key = `uploads/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${Date.now()}_${filename}`;

    const file = storage.bucket(BUCKET).file(key);

    // 署名付き PUT URL（10分）
    const [putUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 10 * 60 * 1000,
      contentType,
    });

    // プロキシ経由 GET URL
    const base =
      process.env.PUBLIC_BASE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const getUrl = `${base}/api/images/${encodeURIComponent(key)}`;

    const payload: UploadUrlResponse = { putUrl, getUrl, key };
    return NextResponse.json(payload, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('upload-url error', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

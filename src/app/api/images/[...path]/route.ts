import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

// === Google Cloud Storage 設定 ===
const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

const BUCKET = process.env.GCS_BUCKET_NAME!;

// === 画像 GET エンドポイント ===
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path?: string[] }> }  // ✅ Promise + Optionalに
) {
  const resolved = await context.params;             // ✅ awaitで展開
  const key = (resolved.path ?? []).join('/');       // ✅ undefined防止

  if (!key) {
    return NextResponse.json({ error: 'Missing file path' }, { status: 400 });
  }

  const file = storage.bucket(BUCKET).file(key);

  try {
    // Content-Type取得
    const [meta] = await file
      .getMetadata()
      .catch(() => [{ contentType: 'application/octet-stream' } as any]);

    // ファイルストリーム生成
    const stream = file.createReadStream();

    // ✅ new Response を使用（NextResponseではstream未対応）
    return new Response(stream as any, {
      status: 200,
      headers: {
        'Content-Type': meta.contentType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    console.error('GCS proxy error', err);
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 });
  }
}

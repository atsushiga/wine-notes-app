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

// Content-Type 取得用型
interface GcsMeta {
  contentType?: string;
}

// === 画像 GET エンドポイント ===
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ path?: string[] }> } // ✅ Promise型
) {
  // ✅ params は Promise なので await 必須
  const resolvedParams = await context.params;
  const key = (resolvedParams.path ?? []).join('/'); // uploads/.../filename.jpg

  if (!key) {
    return NextResponse.json({ error: 'Missing file path' }, { status: 400 });
  }

  const file = storage.bucket(BUCKET).file(key);

  try {
    // ✅ Content-Type取得（例外時はデフォルト値）
    let meta: GcsMeta = { contentType: 'application/octet-stream' };
    try {
      const [metadata] = await file.getMetadata();
      meta = { contentType: metadata.contentType };
    } catch {
      /* ignore: fallback meta used */
    }

    // ✅ Bufferでファイル内容を取得
    const [contents] = await file.download();

    // ✅ Responseで直接返す
    return new Response(new Uint8Array(contents), {
      status: 200,
      headers: {
        'Content-Type': meta.contentType ?? 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    console.error('GCS proxy error:', err);
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 });
  }
}

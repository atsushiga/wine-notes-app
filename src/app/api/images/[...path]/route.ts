
import { NextRequest } from 'next/server';
import { Storage } from '@google-cloud/storage';

export const runtime = 'nodejs';

const storage = new Storage({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL!,
    private_key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  },
  projectId: process.env.GOOGLE_PROJECT_ID!,
});
const BUCKET = process.env.GCS_BUCKET_NAME!;

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const key = params.path.join('/'); // uploads/.../filename.jpg
  const file = storage.bucket(BUCKET).file(key);

  // メタデータから Content-Type を取得
  const [meta] = await file.getMetadata().catch(() => [{ contentType: 'application/octet-stream' } as any]);

  // ストリームを Response にのせる
  const stream = file.createReadStream();

  return new Response(stream as any, {
    status: 200,
    headers: {
      'Content-Type': meta.contentType || 'application/octet-stream',
      // キャッシュ可（お好みで調整）
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

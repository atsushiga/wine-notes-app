import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

export const runtime = 'nodejs'; // 重要: Edgeでは動かない

const storage = new Storage({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL!,
    private_key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  },
  projectId: process.env.GOOGLE_PROJECT_ID!,
});

const BUCKET = process.env.GCS_BUCKET_NAME!;

export async function POST(req: NextRequest) {
  try {
    const { filename, contentType } = await req.json();
    if (!filename || !contentType) {
      return NextResponse.json({ error: 'filename and contentType are required' }, { status: 400 });
    }

    // ファイル鍵：日別フォルダ + タイムスタンプ + オリジナル名（必要なら uuid を使ってもOK）
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const key = `uploads/${y}/${m}/${Date.now()}_${filename}`;

    const bucket = storage.bucket(BUCKET);
    const file = bucket.file(key);

    // PUT用 署名URL（10分）
    const [putUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 10 * 60 * 1000,
      contentType,
    });

    // 読み出し用 署名URL（1年）— Notion で表示に使う場合は長め推奨
    const [getUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 365 * 24 * 60 * 60 * 1000,
    });

    // メタデータ（Content-Typeやキャッシュ）も設定しておくと安心
    await file.setMetadata({
      contentType,
      cacheControl: 'public, max-age=31536000',
    });

    return NextResponse.json({ putUrl, getUrl, key });
  } catch (e: any) {
    console.error('upload-url error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

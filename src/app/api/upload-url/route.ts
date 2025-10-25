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

    const base = process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000';

    // key は 'uploads/2025/10/xxx ファイル名.png' のような形
    // セグメントごとに encode してから / で連結（/ はそのまま残す）
    const proxyPath = key.split('/').map(encodeURIComponent).join('/');
    const proxyUrl = `${base}/api/images/${proxyPath}`;

    // 読み出し用の署名URLは使わないので生成しない（削除してOK）
    // const [getUrl] = await file.getSignedUrl({ ... });

    return NextResponse.json({ putUrl, getUrl: proxyUrl, key });

  } catch (e: any) {
    console.error('upload-url error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

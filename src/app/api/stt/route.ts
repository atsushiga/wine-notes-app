import { NextRequest, NextResponse } from 'next/server';
import OpenAI, { toFile } from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const transcriptionModel = process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe';

function extensionFromMimeType(mimeType: string) {
    if (mimeType.includes('mp4')) return 'mp4';
    if (mimeType.includes('mpeg')) return 'mp3';
    if (mimeType.includes('mp3')) return 'mp3';
    if (mimeType.includes('ogg')) return 'ogg';
    if (mimeType.includes('wav')) return 'wav';
    return 'webm';
}

export async function POST(req: NextRequest) {
    if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ error: 'OPENAI_API_KEY is not set' }, { status: 500 });
    }

    try {
        const formData = await req.formData();
        const audio = formData.get('audio');

        if (!(audio instanceof File)) {
            return NextResponse.json({ error: 'audio file is required' }, { status: 400 });
        }

        if (audio.size === 0) {
            return NextResponse.json({ text: '' }, { status: 200 });
        }

        const mimeType = audio.type || 'audio/webm';
        const buffer = Buffer.from(await audio.arrayBuffer());
        const file = await toFile(
            buffer,
            audio.name || `recording.${extensionFromMimeType(mimeType)}`,
            { type: mimeType }
        );

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const transcription = await openai.audio.transcriptions.create({
            file,
            model: transcriptionModel,
            language: 'ja',
            prompt: 'Japanese wine tasting note. Keep wine terms, grape varieties, regions, WSET/SAT tasting descriptors, and numbers accurate.',
        });

        return NextResponse.json({ text: transcription.text?.trim() || '' }, { status: 200 });
    } catch (error) {
        console.error('STT error:', error);
        const message = error instanceof Error ? error.message : 'Transcription failed';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

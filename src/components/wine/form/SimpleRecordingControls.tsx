'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Mic, MicOff, Square, Trash2 } from 'lucide-react';

interface SimpleRecordingControlsProps {
    enabled: boolean;
    transcript: string;
    isInterpreting: boolean;
    panelOpen: boolean;
    onPanelOpenChange: (open: boolean) => void;
    onTranscriptChunk: (text: string) => void;
    onClearTranscript: () => void;
}

const segmentMs = 8000;

function getSupportedMimeType() {
    if (typeof MediaRecorder === 'undefined') return '';

    const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
    ];

    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

function extensionFromMimeType(mimeType: string) {
    if (mimeType.includes('mp4')) return 'mp4';
    if (mimeType.includes('ogg')) return 'ogg';
    return 'webm';
}

export function SimpleRecordingControls({
    enabled,
    transcript,
    isInterpreting,
    panelOpen,
    onPanelOpenChange,
    onTranscriptChunk,
    onClearTranscript,
}: SimpleRecordingControlsProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<number | null>(null);
    const isActiveRef = useRef(false);
    const pendingRequestsRef = useRef(0);
    const startSegmentRef = useRef<() => void>(() => undefined);

    const stopStream = useCallback(() => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
    }, []);

    const clearSegmentTimer = useCallback(() => {
        if (timerRef.current) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const transcribeBlob = useCallback(async (blob: Blob) => {
        if (blob.size === 0) return;

        pendingRequestsRef.current += 1;
        setIsTranscribing(true);
        setError(null);

        try {
            const mimeType = blob.type || 'audio/webm';
            const formData = new FormData();
            formData.append('audio', blob, `recording.${extensionFromMimeType(mimeType)}`);

            const response = await fetch('/api/stt', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '文字起こしに失敗しました');
            }

            if (data.text) {
                onTranscriptChunk(data.text);
                onPanelOpenChange(true);
            }
        } catch (err) {
            console.error('Transcription request failed:', err);
            setError(err instanceof Error ? err.message : '文字起こしに失敗しました');
        } finally {
            pendingRequestsRef.current -= 1;
            if (pendingRequestsRef.current <= 0) {
                pendingRequestsRef.current = 0;
                setIsTranscribing(false);
            }
        }
    }, [onPanelOpenChange, onTranscriptChunk]);

    const startSegment = useCallback(() => {
        const stream = streamRef.current;
        if (!stream || !isActiveRef.current) return;

        chunksRef.current = [];

        const mimeType = getSupportedMimeType();
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        recorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                chunksRef.current.push(event.data);
            }
        };

        recorder.onstop = () => {
            clearSegmentTimer();
            const type = recorder.mimeType || mimeType || 'audio/webm';
            const blob = new Blob(chunksRef.current, { type });
            chunksRef.current = [];
            void transcribeBlob(blob);

            if (isActiveRef.current) {
                window.setTimeout(() => startSegmentRef.current(), 100);
            } else {
                stopStream();
            }
        };

        recorder.start();
        timerRef.current = window.setTimeout(() => {
            if (recorder.state === 'recording') {
                recorder.stop();
            }
        }, segmentMs);
    }, [clearSegmentTimer, stopStream, transcribeBlob]);

    useEffect(() => {
        startSegmentRef.current = startSegment;
    }, [startSegment]);

    const startRecording = useCallback(async () => {
        if (isRecording) return;

        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
            setError('このブラウザでは録音を利用できません');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                },
            });

            streamRef.current = stream;
            isActiveRef.current = true;
            setIsRecording(true);
            setError(null);
            onPanelOpenChange(true);
            startSegment();
        } catch (err) {
            console.error('Microphone permission failed:', err);
            setError('マイクの使用が許可されませんでした');
        }
    }, [isRecording, onPanelOpenChange, startSegment]);

    const stopRecording = useCallback(() => {
        isActiveRef.current = false;
        setIsRecording(false);
        clearSegmentTimer();

        const recorder = recorderRef.current;
        if (recorder?.state === 'recording') {
            recorder.stop();
        } else {
            stopStream();
        }
    }, [clearSegmentTimer, stopStream]);

    useEffect(() => {
        if (!enabled && isRecording) {
            stopRecording();
        }
    }, [enabled, isRecording, stopRecording]);

    useEffect(() => {
        return () => {
            isActiveRef.current = false;
            clearSegmentTimer();
            if (recorderRef.current?.state === 'recording') {
                recorderRef.current.stop();
            }
            stopStream();
        };
    }, [clearSegmentTimer, stopStream]);

    if (!enabled) return null;

    return (
        <>
            <div className="fixed right-4 top-[calc(env(safe-area-inset-top)+5rem)] z-50 flex flex-col items-end gap-2">
                {error && (
                    <div className="max-w-[220px] rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 shadow-lg">
                        {error}
                    </div>
                )}
                <button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`flex h-14 w-14 items-center justify-center rounded-full border shadow-lg transition-all active:scale-95 ${isRecording
                        ? 'border-red-400 bg-red-600 text-white shadow-red-900/20'
                        : 'border-[var(--border)] bg-[var(--card-bg)] text-[var(--text)] hover:bg-[var(--surface-2)]'
                        }`}
                    aria-label={isRecording ? '録音を停止' : '録音を開始'}
                    aria-pressed={isRecording}
                >
                    {isRecording ? <Square size={22} fill="currentColor" /> : <Mic size={24} />}
                </button>
                <div className="rounded-full border border-[var(--border)] bg-[var(--card-bg)] px-3 py-1 text-xs text-[var(--text-muted)] shadow-sm">
                    {isRecording ? '録音中' : isTranscribing ? '文字起こし中' : '音声入力'}
                </div>
            </div>

            <div
                className={`fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--card-bg)] shadow-2xl transition-transform duration-300 ${panelOpen ? 'translate-y-0' : 'translate-y-[calc(100%-3rem)]'
                    }`}
            >
                <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
                    <button
                        type="button"
                        onClick={() => onPanelOpenChange(!panelOpen)}
                        className="flex min-w-0 items-center gap-2 text-left text-sm font-medium text-[var(--text)]"
                    >
                        {panelOpen ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                        <span>文字起こし</span>
                        {(isTranscribing || isInterpreting) && <Loader2 size={15} className="animate-spin text-[var(--text-muted)]" />}
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={isRecording ? stopRecording : startRecording}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${isRecording
                                ? 'bg-red-600 text-white'
                                : 'bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--app-bg)]'
                                }`}
                        >
                            {isRecording ? (
                                <span className="inline-flex items-center gap-1"><MicOff size={14} />停止</span>
                            ) : (
                                <span className="inline-flex items-center gap-1"><Mic size={14} />録音</span>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={onClearTranscript}
                            className="rounded-full p-2 text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-red-600"
                            aria-label="文字起こしをクリア"
                        >
                            <Trash2 size={15} />
                        </button>
                    </div>
                </div>

                <div className="mx-auto h-[25vh] max-w-4xl overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                    <div className="min-h-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-sm leading-6 text-[var(--text)]">
                        {transcript ? (
                            <p className="whitespace-pre-wrap">{transcript}</p>
                        ) : (
                            <p className="text-[var(--text-muted)]">録音を開始すると、ここに文字起こしが表示されます。</p>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

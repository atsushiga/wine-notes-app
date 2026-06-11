"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    analyzeWineImage,
    generateVisualWineExplanation,
} from "@/app/actions/gemini";
import { saveAiExplanation } from "@/app/actions/aiExplainer";
import type { AiExplainerInput } from "@/lib/aiExplainerStorage";
import {
    getAiExplainerClientKey,
    saveCurrentAiExplanationId,
} from "@/lib/aiExplainerStorage";
import { FORM_CONTROL_BASE } from "@/constants/styles";
import { SectionCard } from "@/components/ui/section-card";
import { FieldRow } from "@/components/ui/field-row";
import {
    Bot,
    Camera,
    CheckCircle2,
    FileImage,
    Loader2,
    Sparkles,
    Wand2,
} from "lucide-react";

type UploadStatus = "idle" | "uploading" | "analyzing" | "ready" | "error";

type UploadedWineState = AiExplainerInput;

function formatPriceInput(value: string) {
    const raw = value.replace(/[^\d]/g, "");
    return raw ? Number(raw).toLocaleString() : "";
}

async function uploadFile(file: File): Promise<string> {
    const payload = {
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
    };

    const uploadUrlResponse = await fetch("/api/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    const { putUrl, getUrl, error } = await uploadUrlResponse.json();
    if (error) throw new Error(error);

    const uploadResponse = await fetch(putUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
    });

    if (!uploadResponse.ok) {
        throw new Error("Upload failed");
    }

    return getUrl;
}

export default function AiExplainerClient() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [previewUrl, setPreviewUrl] = useState("");
    const [form, setForm] = useState<UploadedWineState>({
        wineName: "",
        producer: "",
        vintage: "",
        country: "",
        locality: "",
        imageUrl: "",
        price: "",
    });
    const [status, setStatus] = useState<UploadStatus>("idle");
    const [isGenerating, setIsGenerating] = useState(false);
    const [message, setMessage] = useState("");

    const canGenerate = useMemo(() => {
        return form.wineName.trim().length > 0 && !isGenerating;
    }, [form.wineName, isGenerating]);

    const statusText = {
        idle: "画像を選択してください",
        uploading: "画像をアップロード中",
        analyzing: "AI銘柄検索中",
        ready: "銘柄情報を確認してください",
        error: "手入力で続行できます",
    }[status];

    const updateField = (key: keyof UploadedWineState, value: string) => {
        setForm((current) => ({ ...current, [key]: value }));
    };

    const handleFile = async (file: File | undefined) => {
        if (!file) return;

        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }

        setMessage("");
        setStatus("uploading");
        const nextPreviewUrl = URL.createObjectURL(file);
        setPreviewUrl(nextPreviewUrl);

        try {
            const imageUrl = await uploadFile(file);
            setForm((current) => ({ ...current, imageUrl }));
            setStatus("analyzing");

            const analysis = await analyzeWineImage(imageUrl);
            setForm((current) => ({
                ...current,
                imageUrl,
                wineName: analysis.wineName || current.wineName,
                producer: analysis.producer || current.producer,
                vintage: analysis.vintage || current.vintage,
                country: analysis.country || current.country,
                locality: analysis.locality || current.locality,
                price: analysis.price ? String(analysis.price) : current.price,
            }));
            setStatus("ready");
            setMessage("ラベルから銘柄情報を自動入力しました。必要に応じて修正してください。");
        } catch (error) {
            console.error(error);
            setStatus("error");
            setMessage("画像解析に失敗しました。ワイン名・生産者・ヴィンテージを手入力して生成できます。");
        }
    };

    const handleGenerate = async () => {
        if (!canGenerate) return;

        setIsGenerating(true);
        setMessage("");

        try {
            const explanation = await generateVisualWineExplanation({
                name: form.wineName.trim(),
                producer: form.producer.trim() || undefined,
                vintage: form.vintage.trim() || undefined,
                country: form.country.trim() || undefined,
                locality: form.locality.trim() || undefined,
                price: form.price.trim() || undefined,
            });

            const payload = {
                generatedAt: new Date().toISOString(),
                imageUrl: form.imageUrl,
                input: form,
                explanation,
            };

            const stored = await saveAiExplanation(payload, getAiExplainerClientKey());
            saveCurrentAiExplanationId(stored.id);
            router.push(`/ai-explainer/result?historyId=${encodeURIComponent(stored.id)}`);
        } catch (error) {
            console.error(error);
            setMessage("解説生成に失敗しました。銘柄情報を確認して、もう一度お試しください。");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-6">
            <SectionCard
                title="ラベル画像"
                description="画像を選ぶとAI銘柄検索が自動で始まります"
                icon={<Camera size={18} />}
                tone="neutral"
                className="min-h-[calc(100vh-14rem)] md:min-h-0"
            >
                <div className="grid gap-5 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="group relative flex min-h-72 w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-[var(--border)] bg-[var(--app-bg)] text-center transition-colors hover:border-[var(--primary)]"
                    >
                        {previewUrl ? (
                            <img
                                src={previewUrl}
                                alt="アップロードされたワインラベル"
                                className="absolute inset-0 h-full w-full object-contain p-4"
                            />
                        ) : (
                            <div className="flex flex-col items-center gap-3 px-6">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] text-[var(--primary)]">
                                    <FileImage size={24} />
                                </div>
                                <div>
                                    <p className="font-semibold text-[var(--text)]">画像をアップロード</p>
                                    <p className="mt-1 text-sm text-[var(--text-muted)]">ラベルまたはボトル写真</p>
                                </div>
                            </div>
                        )}
                        <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-[var(--border)] bg-[var(--card-bg)] px-3 py-1 text-xs font-medium text-[var(--text-muted)] shadow-sm">
                            クリックして選択
                        </span>
                    </button>

                    <div className="flex flex-col justify-between gap-4">
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--card-bg)] text-[var(--primary)]">
                                    {status === "uploading" || status === "analyzing" ? (
                                        <Loader2 size={18} className="animate-spin" />
                                    ) : status === "ready" ? (
                                        <CheckCircle2 size={18} />
                                    ) : (
                                        <Bot size={18} />
                                    )}
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-[var(--text)]">{statusText}</p>
                                    <p className="text-xs text-[var(--text-muted)]">
                                        {status === "analyzing"
                                            ? "ワイン名、生産者、ヴィンテージを読み取っています"
                                            : "読み取り後も下の入力欄で修正できます"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {form.country && (
                                <InfoPill label="国" value={form.country} />
                            )}
                            {form.locality && (
                                <InfoPill label="地域" value={form.locality} />
                            )}
                            {form.price && (
                                <InfoPill label="価格" value={`¥${Number(form.price).toLocaleString()}`} />
                            )}
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => handleFile(event.target.files?.[0])}
                        />
                    </div>
                </div>
            </SectionCard>

            <SectionCard
                title="銘柄情報"
                description="AIが自動入力した内容を確認してから生成します"
                icon={<Wand2 size={18} />}
                tone="neutral"
            >
                <div className="grid gap-5">
                    <FieldRow label="ワイン名">
                        <input
                            className={FORM_CONTROL_BASE}
                            placeholder="例: Art Series Chardonnay"
                            value={form.wineName}
                            onChange={(event) => updateField("wineName", event.target.value)}
                        />
                    </FieldRow>

                    <div className="grid gap-5 sm:grid-cols-3">
                        <FieldRow label="生産者">
                            <input
                                className={FORM_CONTROL_BASE}
                                placeholder="例: Leeuwin Estate"
                                value={form.producer}
                                onChange={(event) => updateField("producer", event.target.value)}
                            />
                        </FieldRow>
                        <FieldRow label="ヴィンテージ">
                            <input
                                className={FORM_CONTROL_BASE}
                                placeholder="例: 2021 / NV"
                                value={form.vintage}
                                onChange={(event) => updateField("vintage", event.target.value)}
                            />
                        </FieldRow>
                        <FieldRow label="ボトル価格">
                            <div className="flex items-center gap-2">
                                <input
                                    className={`${FORM_CONTROL_BASE} text-right`}
                                    inputMode="numeric"
                                    placeholder="4,500"
                                    value={formatPriceInput(form.price)}
                                    onChange={(event) => updateField("price", event.target.value.replace(/[^\d]/g, ""))}
                                />
                                <span className="text-sm text-[var(--text-muted)]">円</span>
                            </div>
                        </FieldRow>
                    </div>
                </div>

                {message && (
                    <p className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--text-muted)]">
                        {message}
                    </p>
                )}

                <div className="mt-6 flex flex-col gap-3 border-t border-[var(--border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-[var(--text-muted)]">
                        Web検索で産地・造り・味わいを調べ、ビジュアルな解説ページを生成します。
                    </p>
                    <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={!canGenerate}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-[var(--primary-foreground)] shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isGenerating ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <Sparkles size={18} />
                        )}
                        解説を生成
                    </button>
                </div>
            </SectionCard>
        </div>
    );
}

function InfoPill({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {label}
            </p>
            <p className="mt-0.5 truncate text-sm font-medium text-[var(--text)]">{value}</p>
        </div>
    );
}

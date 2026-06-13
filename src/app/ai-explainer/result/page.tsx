"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    generateVisualWineExplanationImages,
    type AromaVisual,
    type TerroirMapCallout,
    type VisualImageAsset,
    type VisualScale,
    type VisualWineExplanation,
    type VisualWineExplanationRequest,
} from "@/app/actions/gemini";
import { getAiExplanation, saveAiExplanation } from "@/app/actions/aiExplainer";
import {
    getAiExplainerClientKey,
    readCurrentAiExplanationId,
    saveRecordDraftFromVisualExplanation,
    type StoredVisualExplanation,
} from "@/lib/aiExplainerStorage";
import {
    ArrowLeft,
    BadgeInfo,
    BookOpen,
    Calendar,
    ChefHat,
    Cherry,
    Citrus,
    Clock3,
    CloudRain,
    Droplets,
    ExternalLink,
    Factory,
    Flame,
    Flower2,
    GlassWater,
    Grape,
    Layers3,
    Leaf,
    Loader2,
    Mountain,
    MapPin,
    NotebookPen,
    Sparkles,
    Sprout,
    Sun,
    Thermometer,
    Trees,
    Waves,
    Wheat,
    Wine,
    Utensils,
    X,
    ZoomIn,
} from "lucide-react";

type ExpandedImage = {
    src: string;
    alt: string;
    caption?: string;
    label?: string;
    sourceTitle?: string;
    sourceUrl?: string;
};

type ImageOpenHandler = (image: ExpandedImage) => void;

const LEGACY_RESULT_STORAGE_KEY = "wine-ai-visual-explanation";
const HIGHLIGHT_PATTERN = /(酸味?|タンニン|ミネラル|石灰|粘土|砂利|火山|花崗岩|海風|冷涼|昼夜|標高|斜面|水はけ|日照|乾燥|湿度|熟度|果実味|樽|発酵|熟成|余韻|骨格|複雑|エレガント|フレッシュ|塩味|旨味|\d{4}年?)/g;
const HIGHLIGHT_TOKEN_PATTERN = new RegExp(`^${HIGHLIGHT_PATTERN.source}$`);

function asList<T>(value: T[] | undefined, fallback: T[] = []): T[] {
    return Array.isArray(value) ? value : fallback;
}

function readLegacyStoredVisualExplanation(): StoredVisualExplanation | null {
    try {
        const raw = sessionStorage.getItem(LEGACY_RESULT_STORAGE_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw) as Partial<StoredVisualExplanation>;
        if (!parsed.generatedAt || !parsed.explanation || !parsed.input) return null;

        return {
            id: parsed.id || "legacy-session",
            generatedAt: parsed.generatedAt,
            imageUrl: parsed.imageUrl || parsed.input.imageUrl || "",
            input: {
                wineName: parsed.input.wineName || "",
                producer: parsed.input.producer || "",
                vintage: parsed.input.vintage || "",
                country: parsed.input.country || "",
                locality: parsed.input.locality || "",
                imageUrl: parsed.input.imageUrl || parsed.imageUrl || "",
                price: parsed.input.price || "",
                sourceWineId: parsed.input.sourceWineId,
            },
            explanation: parsed.explanation,
        };
    } catch (error) {
        console.error("Failed to read legacy AI explanation", error);
        return null;
    }
}

function assetUrl(asset?: VisualImageAsset) {
    return asset?.url || "";
}

function assetKindLabel(asset?: VisualImageAsset) {
    if (!asset) return "";
    if (asset.kind === "source") return "出典画像";
    if (asset.kind === "source-backed-generated") return "出典情報をもとにAI生成";
    if (asset.kind === "generated") return "AI生成画像";
    return "";
}

function needsVisualImageGeneration(explanation: VisualWineExplanation) {
    const assets = explanation.visualAssets || {};
    const missingMainAsset =
        !assetUrl(assets.map) ||
        !assetUrl(assets.producer) ||
        !assetUrl(assets.aromaBoard) ||
        !assetUrl(assets.pairing);
    const missingAromaTile = asList(explanation.tasting?.aromaVisuals)
        .slice(0, 6)
        .some((aroma) => !assetUrl(aroma.image));

    return missingMainAsset || missingAromaTile;
}

function createVisualImageQuery(data: StoredVisualExplanation): VisualWineExplanationRequest {
    const wine = data.explanation.wine;

    return {
        name: data.input.wineName || wine.name || "Wine",
        producer: data.input.producer || wine.producer || undefined,
        vintage: data.input.vintage || wine.vintage || undefined,
        country: data.input.country || wine.country || undefined,
        locality: data.input.locality || wine.region || undefined,
        price: data.input.price || wine.marketPriceJpy || undefined,
    };
}

function formatPriceDisplay(value: string | number | null | undefined) {
    const raw = String(value ?? "").replace(/[^\d]/g, "");
    if (!raw) return "不明";
    return `¥${Number(raw).toLocaleString()}`;
}

function splitLocalizedName(value: string | undefined) {
    const fullName = (value || "").trim();
    const match = fullName.match(/^(.*\S)\s*[（(]([^()（）]+)[）)]\s*$/);
    const hasJapaneseSubtitle = match ? /[ぁ-んァ-ヶ一-龠々]/.test(match[2]) : false;

    if (!match || !hasJapaneseSubtitle) {
        return { title: fullName, subtitle: "" };
    }

    return {
        title: match[1].trim(),
        subtitle: match[2].trim(),
    };
}

function HighlightText({ text }: { text?: string }) {
    if (!text) return null;

    return (
        <>
            {text.split(HIGHLIGHT_PATTERN).map((part, index) => (
                HIGHLIGHT_TOKEN_PATTERN.test(part) ? (
                    <strong key={`${part}-${index}`} className="font-bold text-[var(--primary)]">
                        {part}
                    </strong>
                ) : (
                    <span key={`${part}-${index}`}>{part}</span>
                )
            ))}
        </>
    );
}

function normalizeAromaVisuals(explanation: VisualWineExplanation): AromaVisual[] {
    const existing = asList(explanation.tasting.aromaVisuals).slice(0, 6);
    if (existing.length > 0) return existing;

    return asList(explanation.tasting.aroma)
        .slice(0, 5)
        .map((item, index) => ({
            label: item.split(/[、,（(]/)[0]?.trim() || `香り ${index + 1}`,
            family: inferAromaFamily(item),
            color: ["#be123c", "#db2777", "#a16207", "#166534", "#475569"][index % 5],
            description: item,
        }));
}

function normalizeTerroirCallouts(explanation: VisualWineExplanation): TerroirMapCallout[] {
    const positions: NonNullable<TerroirMapCallout["position"]>[] = ["top-left", "top-right", "bottom-left", "bottom-right"];
    const existing = asList(explanation.terroir.mapCallouts).slice(0, 4);
    const base: TerroirMapCallout[] = existing.length > 0
        ? existing
        : [
            ...(explanation.terroir.climate ? [{ label: "気候", description: explanation.terroir.climate, icon: "climate" as const }] : []),
            ...(explanation.terroir.soil ? [{ label: "土壌", description: explanation.terroir.soil, icon: "soil" as const }] : []),
            ...asList(explanation.terroir.influences).map((item) => ({
                label: item.title,
                description: item.description,
                icon: "slope" as const,
            })),
        ];

    return base.slice(0, 4).map((item, index) => ({
        ...item,
        position: item.position || positions[index % positions.length],
    }));
}

function inferAromaFamily(text: string): AromaVisual["family"] {
    if (/バラ|スミレ|花|フローラル/.test(text)) return "floral";
    if (/スパイス|胡椒|クローブ|シナモン/.test(text)) return "spice";
    if (/土|森|革|タバコ|きのこ/.test(text)) return "earth";
    if (/ハーブ|ミント|草|葉/.test(text)) return "herbal";
    if (/樽|バニラ|トースト|ナッツ/.test(text)) return "oak";
    if (/石|鉱物|ミネラル|塩/.test(text)) return "mineral";
    if (/レモン|柑橘|オレンジ/.test(text)) return "fruit";
    return "fruit";
}

function AromaIcon({ family, size = 18 }: { family: AromaVisual["family"]; size?: number }) {
    const className = "shrink-0";
    switch (family) {
        case "floral":
            return <Flower2 size={size} className={className} />;
        case "spice":
            return <Flame size={size} className={className} />;
        case "earth":
            return <Trees size={size} className={className} />;
        case "herbal":
            return <Leaf size={size} className={className} />;
        case "oak":
            return <Wheat size={size} className={className} />;
        case "mineral":
            return <Mountain size={size} className={className} />;
        case "fruit":
            return /citrus|柑橘/i.test(family) ? <Citrus size={size} className={className} /> : <Cherry size={size} className={className} />;
        default:
            return <Grape size={size} className={className} />;
    }
}

export default function AiExplainerResultPage() {
    const [data, setData] = useState<StoredVisualExplanation | null>(null);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [isGeneratingVisuals, setIsGeneratingVisuals] = useState(false);
    const visualGenerationPromisesRef = useRef<Map<string, Promise<StoredVisualExplanation>>>(new Map());

    useEffect(() => {
        let isMounted = true;
        const params = new URLSearchParams(window.location.search);
        const historyId = params.get("historyId") || readCurrentAiExplanationId();

        if (!historyId) {
            void Promise.resolve().then(() => {
                if (!isMounted) return;
                setData(readLegacyStoredVisualExplanation());
                setHasLoaded(true);
            });
            return () => {
                isMounted = false;
            };
        }

        getAiExplanation(historyId)
            .then((stored) => {
                if (!isMounted) return;
                setData(stored || readLegacyStoredVisualExplanation());
            })
            .catch((error) => {
                console.error(error);
                if (!isMounted) return;
                setData(readLegacyStoredVisualExplanation());
            })
            .finally(() => {
                if (!isMounted) return;
                setHasLoaded(true);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (!data || !needsVisualImageGeneration(data.explanation)) return;

        let isMounted = true;
        let visualGenerationPromise = visualGenerationPromisesRef.current.get(data.id);

        if (!visualGenerationPromise) {
            visualGenerationPromise = generateVisualWineExplanationImages(createVisualImageQuery(data), data.explanation)
                .then((explanation) => saveAiExplanation({
                    id: data.id,
                    generatedAt: data.generatedAt,
                    imageUrl: data.imageUrl,
                    input: data.input,
                    explanation,
                }, getAiExplainerClientKey()));
            visualGenerationPromisesRef.current.set(data.id, visualGenerationPromise);
        }

        const generatingStateTimeoutId = window.setTimeout(() => {
            if (!isMounted) return;
            setIsGeneratingVisuals(true);
        }, 0);

        visualGenerationPromise
            .then((stored) => {
                if (!isMounted) return;
                setData(stored);
            })
            .catch((error) => {
                console.error("Failed to generate deferred visual assets", error);
            })
            .finally(() => {
                window.clearTimeout(generatingStateTimeoutId);
                if (visualGenerationPromisesRef.current.get(data.id) === visualGenerationPromise) {
                    visualGenerationPromisesRef.current.delete(data.id);
                }
                if (!isMounted) return;
                setIsGeneratingVisuals(false);
            });

        return () => {
            isMounted = false;
            window.clearTimeout(generatingStateTimeoutId);
        };
    }, [data]);

    if (!hasLoaded) {
        return null;
    }

    if (!data) {
        return (
            <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-4 pb-32 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] text-[var(--primary)]">
                    <Sparkles size={24} />
                </div>
                <h1 className="mt-4 text-2xl font-bold text-[var(--text)]">生成結果がありません</h1>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                    AI解説ページで画像と銘柄情報を入力してから生成してください。
                </p>
                <Link
                    href="/ai-explainer"
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)]"
                >
                    <ArrowLeft size={16} />
                    AI解説に戻る
                </Link>
            </main>
        );
    }

    return <VisualWinePage data={data} isGeneratingVisuals={isGeneratingVisuals} />;
}

function VisualWinePage({ data, isGeneratingVisuals }: { data: StoredVisualExplanation; isGeneratingVisuals: boolean }) {
    const router = useRouter();
    const [expandedImage, setExpandedImage] = useState<ExpandedImage | null>(null);
    const explanation = data.explanation;
    const wine = explanation.wine;
    const generatedAt = useMemo(() => {
        return new Date(data.generatedAt).toLocaleString("ja-JP", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    }, [data.generatedAt]);

    const displayName = splitLocalizedName(wine.name || data.input.wineName);
    const takeaways = asList(explanation.keyTakeaways).slice(0, 3);
    const sources = asList(explanation.sources);
    const aromaVisuals = normalizeAromaVisuals(explanation);
    const terroirCallouts = normalizeTerroirCallouts(explanation);
    const visualAssets = explanation.visualAssets || {};
    const featuredPairing = explanation.serving.featuredPairing || asList(explanation.serving.pairings)[0] || "";
    const priceLabel = formatPriceDisplay(data.input.price || wine.marketPriceJpy);
    const drinkingWindow = drinkingWindowLabel(wine.vintage || data.input.vintage);
    const profileFacts = [
        { label: "格付け", value: wine.classification || wine.country || "AI researched" },
        { label: "価格", value: priceLabel },
        { label: "飲み頃", value: drinkingWindow },
        { label: "ペアリング", value: featuredPairing || "料理提案あり" },
    ];
    const regionLabel = [wine.country, wine.region].filter(Boolean).join(" / ") || "不明";
    const tastingScales = useMemo(() => normalizeTasteScales(explanation.tasting.scales, wine), [explanation.tasting.scales, wine]);

    const handleCreateRecord = () => {
        saveRecordDraftFromVisualExplanation(data);
        router.push("/");
    };

    const openImage: ImageOpenHandler = (image) => {
        if (image.src) setExpandedImage(image);
    };

    return (
        <main className="pb-32">
            <section className="border-b border-[var(--border)] bg-[var(--card-bg)]">
                <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <Link
                            href="/ai-explainer"
                            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--primary)]"
                        >
                            <ArrowLeft size={16} />
                            AI解説に戻る
                        </Link>
                        <button
                            type="button"
                            onClick={handleCreateRecord}
                            className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--primary-foreground)] shadow-sm transition-opacity hover:opacity-90"
                        >
                            <NotebookPen size={16} />
                            記録ページに反映
                        </button>
                        {isGeneratingVisuals ? (
                            <span className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--app-bg)] px-3 py-2 text-xs font-semibold text-[var(--text-muted)]">
                                <Loader2 size={14} className="animate-spin" />
                                画像を生成中
                            </span>
                        ) : null}
                    </div>

                    <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(260px,360px)_minmax(0,1fr)]">
                        <div className="relative overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--input-bg)] p-4">
                            {data.imageUrl ? (
                                <div className="flex aspect-[4/5] min-h-[320px] items-center justify-center overflow-hidden rounded-md bg-[var(--app-bg)] sm:min-h-[380px] lg:min-h-0">
                                    <ImageButton
                                        src={data.imageUrl}
                                        alt={`${wine.name} bottle or label`}
                                        className="flex h-full w-full items-center justify-center"
                                        imgClassName="max-h-full max-w-full object-contain"
                                        onOpen={openImage}
                                        caption={wine.name || data.input.wineName}
                                    />
                                </div>
                            ) : (
                                <div className="flex aspect-[4/5] min-h-[320px] items-center justify-center rounded-md bg-[var(--app-bg)] text-[var(--text-muted)] sm:min-h-[380px] lg:min-h-0">
                                    <Wine size={56} />
                                </div>
                            )}
                        </div>

                        <div className="min-w-0">
                            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-5 md:p-6">
                                <h1 className="font-wine text-4xl font-semibold leading-tight tracking-normal text-[var(--text)] sm:text-5xl">
                                    {displayName.title || "名称未設定"}
                                </h1>
                                {displayName.subtitle && (
                                    <p className="mt-2 text-xl font-semibold leading-snug tracking-normal text-[var(--color-gold)] sm:text-2xl">
                                        {displayName.subtitle}
                                    </p>
                                )}

                                <div className="mt-5 grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-2 sm:grid-cols-2">
                                    {profileFacts.map((fact) => (
                                        <CompactProfileFact key={fact.label} label={fact.label} value={fact.value} />
                                    ))}
                                </div>

                                <div className="mt-5 grid gap-2.5">
                                    <ProfileMeta label="生産者" value={wine.producer || data.input.producer || "不明"} />
                                    <div className="grid gap-2.5 sm:grid-cols-2">
                                        <ProfileMeta label="ヴィンテージ" value={wine.vintage || data.input.vintage || "不明"} />
                                        <ProfileMeta label="スタイル" value={wine.style || "検索結果を参照"} />
                                    </div>
                                    <ProfileMeta label="産地" value={regionLabel} emphasis />
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-2">
                            <AiVerdictPanel
                                verdict={explanation.lead || explanation.headline}
                                takeaways={takeaways}
                            />
                        </div>
                    </div>
                </div>
            </section>

            <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
                <section className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
                    <Panel title="テロワール" icon={<MapPin size={18} />}>
                        <div className="rounded-xl border border-[var(--border)] bg-[var(--app-bg)] p-5">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                                        Region Map
                                    </p>
                                    <h3 className="mt-1 text-xl font-bold text-[var(--text)]">
                                        {explanation.terroir.title || wine.region || data.input.locality}
                                    </h3>
                                </div>
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)]">
                                    <MapPin size={22} />
                                </div>
                            </div>
                            <TerroirMapVisual
                                asset={visualAssets.map}
                                label={explanation.terroir.mapHint || wine.region || "産地"}
                                onImageOpen={openImage}
                            />
                            <div className="mt-2 space-y-2">
                                {visualAssets.map?.caption && (
                                    <p className="text-xs leading-5 text-[var(--text-muted)]">
                                        <HighlightText text={visualAssets.map.caption} />
                                    </p>
                                )}
                                <AssetDisclosure asset={visualAssets.map} />
                            </div>
                        </div>
                        <p className="mt-4 text-sm leading-7 text-[var(--text)]">
                            <HighlightText text={explanation.terroir.summary} />
                        </p>
                        <TerroirPointCards callouts={terroirCallouts} />
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <MiniInfo title="気候" value={explanation.terroir.climate} />
                            <MiniInfo title="土壌" value={explanation.terroir.soil} />
                        </div>
                        <TerroirInfluences items={explanation.terroir.influences} />
                    </Panel>

                    <Panel title="Taste Structure" icon={<Grape size={18} />}>
                        <p className="text-sm leading-7 text-[var(--text)]">
                            <HighlightText text={explanation.tasting.overview} />
                        </p>
                        <div className="mt-5">
                            <SectionEyebrow icon={<Layers3 size={16} />} label="Profile Map" />
                        </div>
                        <TasteRadar scales={tastingScales} />
                        <div className="mt-5">
                            <SectionEyebrow icon={<Grape size={16} />} label="Taste Structure" />
                        </div>
                        <div className="mt-5 space-y-5">
                            {tastingScales.map((scale) => (
                                <ScaleBar key={scale.label} scale={scale} />
                            ))}
                        </div>
                    </Panel>
                </section>

                <section className="grid gap-8 lg:grid-cols-3">
                    <Panel title="生産者" icon={<Wine size={18} />}>
                        <ProducerVisual asset={visualAssets.producer} producer={wine.producer || data.input.producer} onImageOpen={openImage} />
                        <p className="text-sm leading-7 text-[var(--text)]">
                            <HighlightText text={explanation.producerStory.summary} />
                        </p>
                        <p className="mt-4 border-l-4 border-[var(--primary)] bg-[var(--app-bg)] p-4 text-sm leading-7 text-[var(--text)]">
                            <HighlightText text={explanation.producerStory.philosophy} />
                        </p>
                        <div className="mt-5 space-y-3">
                            {asList(explanation.producerStory.milestones).slice(0, 4).map((milestone) => (
                                <TimelineItem
                                    key={`${milestone.year}-${milestone.title}`}
                                    label={milestone.year}
                                    title={milestone.title}
                                    description={milestone.description}
                                />
                            ))}
                        </div>
                    </Panel>

                    <Panel title="技術情報" icon={<Sparkles size={18} />}>
                        <p className="text-sm leading-7 text-[var(--text)]">
                            <HighlightText text={explanation.winemaking.summary} />
                        </p>
                        <div className="mt-5 space-y-3">
                            {asList(explanation.winemaking.steps).slice(0, 5).map((step, index) => (
                                <FlowStep
                                    key={`${step.label}-${index}`}
                                    index={index + 1}
                                    label={step.label}
                                    description={step.description}
                                />
                            ))}
                        </div>
                    </Panel>

                    <Panel title="ヴィンテージ" icon={<Calendar size={18} />}>
                        <p className="text-sm leading-7 text-[var(--text)]">
                            <HighlightText text={explanation.vintage.summary} />
                        </p>
                        <div className="mt-5 space-y-3">
                            {asList(explanation.vintage.conditions).map((condition, index) => (
                                <NumberedNote key={`${condition}-${index}`} index={index + 1} text={condition} />
                            ))}
                        </div>
                    </Panel>
                </section>

                <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
                    <Panel title="香り・味わいの読み解き" icon={<Grape size={18} />}>
                        <AromaImageBoard asset={visualAssets.aromaBoard} onImageOpen={openImage} />
                        <AromaVisualGrid aromas={aromaVisuals} onImageOpen={openImage} />
                        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_0.8fr]">
                            <TastingColumn title="香りの根拠" items={explanation.tasting.aroma} />
                            <TastingColumn title="味わい" items={explanation.tasting.palate} />
                            <div className="rounded-xl border border-[var(--border)] bg-[var(--app-bg)] p-4">
                                <div className="flex items-center gap-2 text-sm font-bold text-[var(--text)]">
                                    <Clock3 size={16} className="text-[var(--primary)]" />
                                    余韻
                                </div>
                                <p className="mt-3 text-sm leading-7 text-[var(--text)]">
                                    <HighlightText text={explanation.tasting.finish} />
                                </p>
                            </div>
                        </div>
                    </Panel>

                    <Panel title="フードペアリング" icon={<Thermometer size={18} />}>
                        <PairingVisual asset={visualAssets.pairing} pairing={featuredPairing} onImageOpen={openImage} />
                        <div className="grid gap-3">
                            <IconInfo title="温度" value={explanation.serving.temperature} icon={<Thermometer size={17} />} />
                            <IconInfo title="グラス" value={explanation.serving.glass} icon={<GlassWater size={17} />} />
                            <IconInfo title="デキャンタージュ" value={explanation.serving.decant} icon={<Waves size={17} />} />
                        </div>
                        <div className="mt-5">
                            <SectionEyebrow icon={<ChefHat size={16} />} label="合わせたい料理" />
                            <div className="mt-3 flex flex-wrap gap-2">
                                {asList(explanation.serving.pairings).map((pairing) => (
                                    <span
                                        key={pairing}
                                        className="rounded-full border border-[var(--border)] bg-[var(--app-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--text)]"
                                    >
                                        {pairing}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </Panel>
                </section>

                <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
                    <Panel title="学習ポイント" icon={<BookOpen size={18} />}>
                        <div className="grid gap-3">
                            {asList(explanation.studyPoints).map((point, index) => (
                                <div key={`${point.title}-${index}`} className="border-l-4 border-[var(--primary)] bg-[var(--app-bg)] p-4">
                                    <p className="font-bold text-[var(--text)]">{point.title}</p>
                                    <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                                        <HighlightText text={point.description} />
                                    </p>
                                </div>
                            ))}
                        </div>
                    </Panel>

                    <Panel title="参考情報" icon={<ExternalLink size={18} />}>
                        <div className="mb-4 rounded-lg bg-[var(--app-bg)] px-3 py-2">
                            <p className="text-xs font-bold text-[var(--primary)]">生成日時</p>
                            <p className="mt-1 text-sm leading-6 text-[var(--text)]">{generatedAt}</p>
                        </div>
                        <div className="space-y-2">
                            {asList(explanation.sourceNotes).map((note, index) => (
                                <p key={`${note}-${index}`} className="rounded-lg bg-[var(--app-bg)] px-3 py-2 text-sm leading-6 text-[var(--text)]">
                                    <HighlightText text={note} />
                                </p>
                            ))}
                        </div>
                        {sources.length > 0 && (
                            <div className="mt-5 space-y-2">
                                {sources.map((source, index) => (
                                    <a
                                        key={`${source.url || source.title}-${index}`}
                                        href={source.url || "#"}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-start gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)] hover:border-[var(--primary)]"
                                    >
                                        <ExternalLink size={15} className="mt-0.5 shrink-0 text-[var(--primary)]" />
                                        <span className="line-clamp-2">{source.title || source.url}</span>
                                    </a>
                                ))}
                            </div>
                        )}
                    </Panel>
                </section>
            </div>
            <ImageLightbox image={expandedImage} onClose={() => setExpandedImage(null)} />
        </main>
    );
}

function SectionEyebrow({ icon, label }: { icon: React.ReactNode; label: string }) {
    return (
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-gold)]">
            {icon}
            {label}
        </div>
    );
}

function CompactProfileFact({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0 rounded-md bg-[var(--input-bg)] px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
            <p className="mt-1 break-words text-sm font-semibold leading-5 text-[var(--text)]">{value}</p>
        </div>
    );
}

function AiVerdictPanel({
    verdict,
    takeaways,
}: {
    verdict?: string;
    takeaways: string[];
}) {
    return (
        <aside className="rounded-lg border border-[var(--color-gold)]/35 bg-[var(--color-gold-soft)] p-5 md:p-6">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-gold)]">AI Verdict</p>
                    <h2 className="mt-2 text-2xl font-semibold text-[var(--text)]">Sommelier Brief</h2>
                </div>
                <Sparkles size={24} className="text-[var(--color-gold)]" />
            </div>
            <p className="mt-5 text-sm leading-7 text-[var(--text)]">
                <HighlightText text={verdict || "AIが調査した情報をもとに、このワインの特徴を整理しました。"} />
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
                {takeaways.length > 0 ? takeaways.map((takeaway, index) => (
                    <div key={`${takeaway}-${index}`} className="rounded-lg border border-[var(--color-gold)]/20 bg-[var(--card-bg)]/70 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-gold)]">
                            Point {String(index + 1).padStart(2, "0")}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                            <HighlightText text={takeaway} />
                        </p>
                    </div>
                )) : (
                    <div className="rounded-lg border border-[var(--color-gold)]/20 bg-[var(--card-bg)]/70 p-3 text-sm text-[var(--text-soft)]">
                        要点は生成結果に含まれていません。
                    </div>
                )}
            </div>
        </aside>
    );
}

function ProfileMeta({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
    return (
        <div className={`rounded-md border border-[var(--border)] bg-[var(--card-bg)] ${emphasis ? "px-4 py-3" : "px-3 py-2.5"}`}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
            <p className={`mt-1 break-words font-semibold text-[var(--text)] ${emphasis ? "text-[15px] leading-7" : "text-sm leading-6"}`}>{value}</p>
        </div>
    );
}

function drinkingWindowLabel(vintage?: string) {
    const match = (vintage || "").match(/\b(19|20)\d{2}\b/);
    if (!match) return "Now-5 years";

    const year = Number(match[0]);
    return `${year + 5}-${year + 14}`;
}

function normalizeScaleValue(value: number) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return 0;
    const percentValue = numericValue <= 10 ? numericValue * 10 : numericValue;
    return Math.min(100, Math.max(0, percentValue));
}

function scaleCapForWine(label: string, wine: VisualWineExplanation["wine"]) {
    const wineText = [
        wine.name,
        wine.producer,
        wine.country,
        wine.region,
        wine.style,
        ...asList(wine.grapeVarieties),
    ].join(" ");
    const isBurgundy = /bourgogne|burgundy|ブルゴーニュ|côte|コート/i.test(wineText);
    const isPinot = /pinot|ピノ/i.test(wineText);
    const isChardonnay = /chardonnay|シャルドネ/i.test(wineText);

    if (isBurgundy && isPinot) {
        if (/ボディ/.test(label)) return 58;
        if (/タンニン/.test(label)) return 60;
        if (/アルコール/.test(label)) return 58;
        if (/果実|熟度/.test(label)) return 68;
        if (/樽/.test(label)) return 55;
        if (/余韻/.test(label)) return 74;
        if (/酸/.test(label)) return 82;
    }

    if (isBurgundy && isChardonnay) {
        if (/ボディ/.test(label)) return 62;
        if (/アルコール/.test(label)) return 60;
        if (/果実|熟度/.test(label)) return 70;
        if (/樽/.test(label)) return 66;
        if (/酸/.test(label)) return 84;
    }

    return 100;
}

function normalizeTasteScales(scales: VisualScale[] | undefined, wine: VisualWineExplanation["wine"]): VisualScale[] {
    return asList(scales).map((scale) => {
        const value = normalizeScaleValue(scale.value);
        const cappedValue = Math.min(value, scaleCapForWine(scale.label, wine));
        return {
            ...scale,
            value: Math.round(cappedValue),
        };
    });
}

function ImageCreditOverlay({ asset }: { asset?: VisualImageAsset }) {
    const label = assetKindLabel(asset);
    if (!label) return null;

    return (
        <span className="pointer-events-none absolute bottom-2 right-2 z-10 rounded-full bg-black/62 px-2 py-1 text-[10px] font-semibold leading-none text-white shadow-sm">
            {label}
        </span>
    );
}

function AssetDisclosure({ asset, compact = false }: { asset?: VisualImageAsset; compact?: boolean }) {
    const label = assetKindLabel(asset);
    const hasSource = Boolean(asset?.sourceUrl);
    if (!label && !hasSource) return null;

    return (
        <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 leading-5 text-[var(--text-muted)] ${compact ? "text-[10px]" : "text-xs"}`}>
            {label && (
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 font-semibold text-[var(--text)]">
                    {label}
                </span>
            )}
            {asset?.sourceUrl && (
                <a
                    href={asset.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-w-0 items-center gap-1 break-all font-semibold text-[var(--primary)]"
                >
                    <ExternalLink size={compact ? 11 : 13} className="shrink-0" />
                    <span>出典: {asset.sourceTitle || asset.sourceUrl}</span>
                </a>
            )}
        </div>
    );
}

function ImageButton({
    src,
    alt,
    caption,
    asset,
    className,
    imgClassName,
    onOpen,
}: {
    src: string;
    alt: string;
    caption?: string;
    asset?: VisualImageAsset;
    className?: string;
    imgClassName?: string;
    onOpen?: ImageOpenHandler;
}) {
    return (
        <button
            type="button"
            onClick={() => onOpen?.({
                src,
                alt,
                caption: caption || asset?.caption,
                label: assetKindLabel(asset),
                sourceTitle: asset?.sourceTitle,
                sourceUrl: asset?.sourceUrl,
            })}
            className={`group relative block overflow-hidden text-left ${className || ""}`}
            aria-label={`${alt}を拡大`}
        >
            <img src={src} alt={alt} className={imgClassName || "h-full w-full object-cover"} />
            <span className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <ZoomIn size={16} />
            </span>
            <ImageCreditOverlay asset={asset} />
        </button>
    );
}

function ImageLightbox({ image, onClose }: { image: ExpandedImage | null; onClose: () => void }) {
    if (!image) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/88 px-4 py-8"
            role="dialog"
            aria-modal="true"
            onClick={onClose}
        >
            <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/12 text-white transition-colors hover:bg-white/20"
                aria-label="拡大画像を閉じる"
            >
                <X size={22} />
            </button>
            <figure className="flex max-h-full max-w-6xl flex-col items-center gap-3" onClick={(event) => event.stopPropagation()}>
                <img src={image.src} alt={image.alt} className="max-h-[82vh] max-w-full rounded-xl object-contain shadow-2xl" />
                {(image.label || image.caption || image.sourceUrl) && (
                    <figcaption className="flex max-w-3xl flex-col items-center gap-2 text-center text-xs leading-5 text-white/82">
                        {(image.label || image.caption) && (
                            <span>
                                {image.label && <span className="font-semibold text-white">{image.label}</span>}
                                {image.label && image.caption ? " / " : ""}
                                {image.caption}
                            </span>
                        )}
                        {image.sourceUrl && (
                            <a
                                href={image.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex max-w-full items-center gap-1 break-all font-semibold text-white"
                            >
                                <ExternalLink size={13} className="shrink-0" />
                                <span>出典: {image.sourceTitle || image.sourceUrl}</span>
                            </a>
                        )}
                    </figcaption>
                )}
            </figure>
        </div>
    );
}

function ProducerVisual({ asset, producer, onImageOpen }: { asset?: VisualImageAsset; producer?: string; onImageOpen?: ImageOpenHandler }) {
    const src = assetUrl(asset);
    return (
        <div className="mb-5 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--app-bg)]">
            <div className="relative h-44 bg-[var(--surface-2)]">
                {src ? (
                    <ImageButton
                        src={src}
                        alt={`${producer || "生産者"} visual`}
                        asset={asset}
                        onOpen={onImageOpen}
                        className="h-full w-full"
                        imgClassName="h-full w-full object-cover"
                    />
                ) : (
                    <div className="grid h-full grid-cols-3 items-center gap-3 p-5 text-[var(--primary)]">
                        <div className="flex h-20 items-center justify-center rounded-xl bg-[var(--card-bg)]">
                            <Factory size={34} />
                        </div>
                        <div className="flex h-24 items-center justify-center rounded-xl bg-[var(--card-bg)]">
                            <Trees size={38} />
                        </div>
                        <div className="flex h-20 items-center justify-center rounded-xl bg-[var(--card-bg)]">
                            <Wine size={34} />
                        </div>
                    </div>
                )}
            </div>
            <div className="space-y-2 p-3">
                {asset?.caption && (
                    <p className="text-xs leading-5 text-[var(--text)]"><HighlightText text={asset.caption} /></p>
                )}
                <AssetDisclosure asset={asset} />
            </div>
        </div>
    );
}

function TerroirMapVisual({
    asset,
    label,
    onImageOpen,
}: {
    asset?: VisualImageAsset;
    label: string;
    onImageOpen?: ImageOpenHandler;
}) {
    const src = assetUrl(asset);
    if (src) {
        return (
            <div className="relative h-72 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card-bg)] sm:h-80">
                <ImageButton
                    src={src}
                    alt={label}
                    asset={asset}
                    onOpen={onImageOpen}
                    className="h-full w-full"
                    imgClassName="h-full w-full object-cover"
                />
            </div>
        );
    }

    return (
        <div className="relative h-72 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card-bg)] sm:h-80">
            <div className="absolute left-7 top-10 h-24 w-36 rotate-[-12deg] rounded-[45%] border-2 border-[var(--border)] bg-[var(--surface-2)]" />
            <div className="absolute bottom-10 right-8 h-28 w-48 rotate-[10deg] rounded-[50%] border-2 border-[var(--border)] bg-[var(--surface-2)]" />
            <div className="absolute left-7 bottom-7 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--app-bg)] text-[var(--primary)]">
                <Waves size={22} />
            </div>
            <div className="absolute right-8 top-8 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--app-bg)] text-[var(--primary)]">
                <Mountain size={22} />
            </div>
            <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 rounded-xl bg-[var(--card-bg)]/95 px-3 py-2 text-xs font-bold text-[var(--text)] shadow-sm">
                <MapPin size={15} className="text-[var(--primary)]" />
                <span className="line-clamp-2">{label}</span>
            </div>
        </div>
    );
}

function TerroirCalloutIcon({ icon, size = 15 }: { icon?: TerroirMapCallout["icon"]; size?: number }) {
    switch (icon) {
        case "coast":
        case "river":
            return <Waves size={size} />;
        case "mountain":
            return <Mountain size={size} />;
        case "soil":
            return <Layers3 size={size} />;
        case "slope":
            return <Sprout size={size} />;
        case "climate":
            return <Sun size={size} />;
        default:
            return <MapPin size={size} />;
    }
}

function TerroirPointCards({ callouts }: { callouts?: TerroirMapCallout[] }) {
    const list = asList(callouts).slice(0, 4);
    if (list.length === 0) return null;

    return (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {list.map((callout, index) => (
                <div key={`${callout.label}-${index}`} className="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--app-bg)] p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--card-bg)] text-[var(--primary)]">
                        <TerroirCalloutIcon icon={callout.icon} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-[var(--text)]">{callout.label}</p>
                        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                            <HighlightText text={callout.description} />
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
}

function TerroirInfluences({ items }: { items?: { title: string; description: string }[] }) {
    const list = asList(items).slice(0, 3);
    if (list.length === 0) return null;

    const icons = [
        <Sun key="sun" size={16} />,
        <CloudRain key="cloud-rain" size={16} />,
        <Mountain key="mountain" size={16} />,
    ];
    const gridClass = list.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3";
    return (
        <div className={`mt-4 grid gap-3 ${gridClass}`}>
            {list.map((item, index) => (
                <div key={`${item.title}-${index}`} className="rounded-xl border border-[var(--border)] bg-[var(--app-bg)] p-3">
                    <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--card-bg)] text-[var(--primary)]">
                        {icons[index % icons.length]}
                    </div>
                    <p className="text-sm font-bold text-[var(--text)]">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                        <HighlightText text={item.description} />
                    </p>
                </div>
            ))}
        </div>
    );
}

function compactScaleLabel(label: string) {
    return label
        .replace("果実の熟度", "果実熟度")
        .replace("樽の存在感", "樽感")
        .replace("アルコール感", "アルコール");
}

function TasteRadar({ scales }: { scales?: VisualScale[] }) {
    const list = asList(scales).slice(0, 6);
    if (list.length < 3) return null;

    const center = 120;
    const radius = 64;
    const labelRadius = 90;
    const points = list.map((scale, index) => {
        const angle = -Math.PI / 2 + (index * 2 * Math.PI) / list.length;
        const value = Math.min(100, Math.max(0, Number(scale.value) || 0)) / 100;
        return {
            x: center + Math.cos(angle) * radius * value,
            y: center + Math.sin(angle) * radius * value,
            axisX: center + Math.cos(angle) * radius,
            axisY: center + Math.sin(angle) * radius,
            labelX: center + Math.cos(angle) * labelRadius,
            labelY: center + Math.sin(angle) * labelRadius,
            label: compactScaleLabel(scale.label),
        };
    });
    const polygon = points.map((point) => `${point.x},${point.y}`).join(" ");

    return (
        <div className="mt-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--input-bg)] p-4">
            <svg viewBox="0 0 240 240" className="mx-auto h-60 w-60 max-w-full overflow-hidden">
                {[0.25, 0.5, 0.75, 1].map((step) => (
                    <circle
                        key={step}
                        cx={center}
                        cy={center}
                        r={radius * step}
                        fill="none"
                        stroke="var(--chart-grid)"
                        strokeWidth="1"
                    />
                ))}
                {points.map((point) => (
                    <line
                        key={`${point.label}-axis`}
                        x1={center}
                        y1={center}
                        x2={point.axisX}
                        y2={point.axisY}
                        stroke="var(--chart-grid)"
                        strokeWidth="1"
                    />
                ))}
                <polygon points={polygon} fill="var(--color-gold)" opacity="0.16" stroke="var(--color-gold)" strokeWidth="2" />
                {points.map((point) => (
                    <g key={point.label}>
                        <circle cx={point.x} cy={point.y} r="4" fill="var(--color-gold)" />
                        <text
                            x={point.labelX}
                            y={point.labelY}
                            textAnchor={point.labelX > center ? "start" : point.labelX < center ? "end" : "middle"}
                            dominantBaseline="middle"
                            fill="var(--text)"
                            fontSize="9"
                            fontWeight="700"
                        >
                            {point.label}
                        </text>
                    </g>
                ))}
            </svg>
        </div>
    );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <section className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.16)] sm:p-6">
            <div className="mb-5 flex items-center gap-3 border-b border-[var(--border-subtle)] pb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--input-bg)] text-[var(--color-gold)]">
                    {icon}
                </div>
                <h2 className="text-lg font-semibold text-[var(--text)]">{title}</h2>
            </div>
            {children}
        </section>
    );
}

function MiniInfo({ title, value }: { title: string; value?: string }) {
    return (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4">
            <p className="text-xs font-bold text-[var(--color-gold)]">{title}</p>
            <p className="mt-2 text-sm leading-7 text-[var(--text)]">
                <HighlightText text={value || "公開情報から確認中"} />
            </p>
        </div>
    );
}

function IconInfo({ title, value, icon }: { title: string; value?: string; icon: React.ReactNode }) {
    return (
        <div className="flex gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--input-bg)] text-[var(--color-gold)]">
                {icon}
            </div>
            <div>
                <p className="text-xs font-bold text-[var(--color-gold)]">{title}</p>
                <p className="mt-1 text-sm leading-6 text-[var(--text)]">
                    <HighlightText text={value || "公開情報から確認中"} />
                </p>
            </div>
        </div>
    );
}

function AromaImageBoard({ asset, onImageOpen }: { asset?: VisualImageAsset; onImageOpen?: ImageOpenHandler }) {
    const src = assetUrl(asset);
    if (!src) return null;

    return (
        <div className="mb-5 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--app-bg)]">
            <div className="relative h-56">
                <ImageButton
                    src={src}
                    alt={asset?.alt || asset?.caption || "代表的な香りのイメージ"}
                    asset={asset}
                    onOpen={onImageOpen}
                    className="h-full w-full"
                    imgClassName="h-full w-full object-cover"
                />
            </div>
            <div className="space-y-2 px-3 py-2">
                {asset?.caption && (
                    <p className="text-xs leading-5 text-[var(--text-muted)]">
                        <HighlightText text={asset.caption} />
                    </p>
                )}
                <AssetDisclosure asset={asset} />
            </div>
        </div>
    );
}

function PairingVisual({ asset, pairing, onImageOpen }: { asset?: VisualImageAsset; pairing?: string; onImageOpen?: ImageOpenHandler }) {
    const src = assetUrl(asset);
    if (!src) return null;

    return (
        <div className="mb-5 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--app-bg)]">
            <div className="relative h-48">
                <ImageButton
                    src={src}
                    alt={asset?.alt || `${pairing || "ペアリング"}の料理画像`}
                    asset={asset}
                    onOpen={onImageOpen}
                    className="h-full w-full"
                    imgClassName="h-full w-full object-cover"
                />
                <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-[var(--card-bg)]/95 px-3 py-1 text-[10px] font-bold text-[var(--primary)] shadow-sm">
                    <Utensils size={13} />
                    {pairing || "ペアリング"}
                </div>
            </div>
            <div className="space-y-2 px-3 py-2">
                {asset?.caption && (
                    <p className="text-xs leading-5 text-[var(--text-muted)]">
                        <HighlightText text={asset.caption} />
                    </p>
                )}
                <AssetDisclosure asset={asset} />
            </div>
        </div>
    );
}

function AromaVisualGrid({ aromas, onImageOpen }: { aromas: AromaVisual[]; onImageOpen?: ImageOpenHandler }) {
    if (aromas.length === 0) return null;

    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {aromas.map((aroma) => (
                <div key={`${aroma.label}-${aroma.description}`} className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--app-bg)]">
                    <div className="relative h-28" style={{ background: `linear-gradient(135deg, ${aroma.color || "#be123c"} 0%, var(--card-bg) 78%)` }}>
                        {aroma.image?.url ? (
                            <>
                                <ImageButton
                                    src={aroma.image.url}
                                    alt={aroma.image.alt || `${aroma.label}の香りイメージ`}
                                    asset={aroma.image}
                                    onOpen={onImageOpen}
                                    className="h-full w-full"
                                    imgClassName="h-full w-full object-cover"
                                />
                                <div className="pointer-events-none absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-xl bg-black/35 text-white shadow-sm">
                                    <AromaIcon family={aroma.family} size={22} />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="absolute left-3 top-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--card-bg)]/95 text-[var(--primary)] shadow-sm">
                                    <AromaIcon family={aroma.family} size={23} />
                                </div>
                                <div className="absolute bottom-3 right-3 flex gap-2 text-[var(--card-bg)]/80">
                                    <CircleVisual />
                                    <CircleVisual small />
                                    <CircleVisual />
                                </div>
                            </>
                        )}
                    </div>
                    <div className="p-3">
                        <p className="text-sm font-bold text-[var(--text)]">{aroma.label}</p>
                        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                            <HighlightText text={aroma.description} />
                        </p>
                        <div className="mt-2">
                            <AssetDisclosure asset={aroma.image} compact />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function CircleVisual({ small = false }: { small?: boolean }) {
    return (
        <span
            className={`${small ? "h-6 w-6" : "h-9 w-9"} rounded-full border border-[var(--card-bg)]/70 bg-[var(--card-bg)]/30`}
        />
    );
}

function ScaleIcon({ label }: { label: string }) {
    if (/酸/.test(label)) return <Citrus size={18} />;
    if (/果実|熟度/.test(label)) return <Cherry size={18} />;
    if (/樽/.test(label)) return <Wheat size={18} />;
    if (/タンニン|ボディ/.test(label)) return <Layers3 size={18} />;
    if (/アルコール/.test(label)) return <Flame size={18} />;
    if (/余韻/.test(label)) return <Clock3 size={18} />;
    return <Grape size={18} />;
}

function ScaleBar({ scale }: { scale: VisualScale }) {
    const value = Math.min(100, Math.max(0, Number(scale.value) || 0));

    return (
        <div className="grid grid-cols-[42px_minmax(0,1fr)] gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--input-bg)] text-[var(--color-gold)]">
                <ScaleIcon label={scale.label} />
            </div>
            <div>
                <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                        <p className="font-bold text-[var(--text)]">{scale.label}</p>
                        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                            <HighlightText text={scale.note} />
                        </p>
                    </div>
                    <span className="rounded-full bg-[var(--input-bg)] px-2.5 py-1 text-xs font-bold text-[var(--color-gold)]">
                        {value}
                    </span>
                </div>
                <div className="relative h-3 rounded-full bg-[var(--input-bg)]">
                    <div
                        className="absolute left-0 top-0 h-3 rounded-full bg-[var(--primary)]"
                        style={{ width: `${value}%` }}
                    />
                    <div
                        className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--card-bg)] bg-[var(--primary)] shadow-sm"
                        style={{ left: `${value}%` }}
                    />
                </div>
                <div className="mt-1 flex justify-between gap-3 text-xs text-[var(--text-muted)]">
                    <span className="min-w-0 break-words">{scale.lowLabel}</span>
                    <span className="min-w-0 break-words text-right">{scale.highLabel}</span>
                </div>
            </div>
        </div>
    );
}

function TimelineItem({ label, title, description }: { label: string; title: string; description: string }) {
    return (
        <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3">
            <div className="text-sm font-bold text-[var(--primary)]">{label}</div>
            <div>
                <p className="text-sm font-bold text-[var(--text)]">{title}</p>
                <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                    <HighlightText text={description} />
                </p>
            </div>
        </div>
    );
}

function FlowStep({ index, label, description }: { index: number; label: string; description: string }) {
    return (
        <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 rounded-xl bg-[var(--app-bg)] p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary)] text-sm font-bold text-[var(--primary-foreground)]">
                {index === 1 ? <Sprout size={16} /> : index === 2 ? <Droplets size={16} /> : index === 3 ? <Factory size={16} /> : <Layers3 size={16} />}
            </div>
            <div>
                <p className="text-sm font-bold text-[var(--text)]">
                    <span className="mr-2 text-[var(--primary)]">{String(index).padStart(2, "0")}</span>
                    {label}
                </p>
                <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                    <HighlightText text={description} />
                </p>
            </div>
        </div>
    );
}

function NumberedNote({ index, text }: { index: number; text: string }) {
    const icons = [
        <Sun key="sun" size={16} />,
        <CloudRain key="cloud-rain" size={16} />,
        <Thermometer key="thermometer" size={16} />,
        <Droplets key="droplets" size={16} />,
        <Grape key="grape" size={16} />,
        <BadgeInfo key="badge-info" size={16} />,
    ];
    return (
        <div className="flex gap-3 rounded-xl bg-[var(--app-bg)] p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--card-bg)] text-[var(--primary)]">
                {icons[(index - 1) % icons.length]}
            </span>
            <p className="text-sm leading-6 text-[var(--text)]">
                <HighlightText text={text} />
            </p>
        </div>
    );
}

function TastingColumn({ title, items }: { title: string; items?: string[] }) {
    return (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--app-bg)] p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--text)]">
                <BadgeInfo size={16} className="text-[var(--primary)]" />
                {title}
            </div>
            <ul className="mt-3 space-y-2">
                {asList(items).map((item) => (
                    <li key={item} className="flex gap-2 text-sm leading-6 text-[var(--text)]">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                        <span><HighlightText text={item} /></span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

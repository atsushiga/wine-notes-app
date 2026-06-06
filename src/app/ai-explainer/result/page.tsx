"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AromaVisual, TerroirMapCallout, VisualImageAsset, VisualScale, VisualWineExplanation } from "@/app/actions/gemini";
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
    Compass,
    Droplets,
    ExternalLink,
    Factory,
    Flame,
    Flower2,
    GlassWater,
    Grape,
    Layers3,
    Leaf,
    Map,
    Mountain,
    MapPin,
    ScanSearch,
    Sparkles,
    Sprout,
    Sun,
    Thermometer,
    Trees,
    Waves,
    Wheat,
    Wine,
} from "lucide-react";

const RESULT_STORAGE_KEY = "wine-ai-visual-explanation";

interface UploadedWineState {
    wineName: string;
    producer: string;
    vintage: string;
    country: string;
    locality: string;
    imageUrl: string;
}

interface StoredVisualExplanation {
    generatedAt: string;
    imageUrl: string;
    input: UploadedWineState;
    explanation: VisualWineExplanation;
}

function asList<T>(value: T[] | undefined, fallback: T[] = []): T[] {
    return Array.isArray(value) ? value : fallback;
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

    useEffect(() => {
        const stored = sessionStorage.getItem(RESULT_STORAGE_KEY);
        if (stored) {
            try {
                setData(JSON.parse(stored) as StoredVisualExplanation);
            } catch (error) {
                console.error(error);
            }
        }
        setHasLoaded(true);
    }, []);

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

    return <VisualWinePage data={data} />;
}

function VisualWinePage({ data }: { data: StoredVisualExplanation }) {
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

    const grapeVarieties = asList(wine.grapeVarieties, ["品種情報を検索中"]);
    const takeaways = asList(explanation.keyTakeaways).slice(0, 4);
    const sources = asList(explanation.sources);
    const aromaVisuals = normalizeAromaVisuals(explanation);
    const terroirCallouts = normalizeTerroirCallouts(explanation);
    const visualAssets = explanation.visualAssets || {};

    return (
        <main className="pb-32">
            <section className="border-b border-[var(--border)] bg-[var(--card-bg)]">
                <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)] lg:px-8">
                    <div className="flex flex-col justify-between gap-8">
                        <div>
                            <Link
                                href="/ai-explainer"
                                className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--primary)]"
                            >
                                <ArrowLeft size={16} />
                                AI解説に戻る
                            </Link>
                            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
                                Visual Wine Lecture
                            </p>
                            <h1 className="mt-3 text-4xl font-bold leading-tight tracking-normal text-[var(--text)] sm:text-5xl">
                                {wine.name || data.input.wineName}
                            </h1>
                            <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--text)]">
                                {explanation.headline}
                            </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <FactTile label="生産者" value={wine.producer || data.input.producer || "不明"} />
                            <FactTile label="ヴィンテージ" value={wine.vintage || data.input.vintage || "不明"} />
                            <FactTile label="産地" value={[wine.country, wine.region].filter(Boolean).join(" / ") || "不明"} />
                            <FactTile label="スタイル" value={wine.style || "検索結果を参照"} />
                        </div>
                        <VisualSignalStrip
                            items={[
                                { icon: <Map size={18} />, label: "産地", value: wine.region || data.input.locality || wine.country || "地域情報" },
                                { icon: <Grape size={18} />, label: "品種", value: grapeVarieties.slice(0, 2).join(" / ") },
                                { icon: <Compass size={18} />, label: "格付け", value: wine.classification || "参照範囲を確認" },
                                { icon: <Thermometer size={18} />, label: "提供", value: explanation.serving.temperature || "温度未確認" },
                            ]}
                        />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-[minmax(160px,0.8fr)_minmax(0,1fr)] lg:grid-cols-1">
                        <div className="relative min-h-80 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--app-bg)]">
                            {data.imageUrl ? (
                                <img
                                    src={data.imageUrl}
                                    alt={`${wine.name} bottle or label`}
                                    className="absolute inset-0 h-full w-full object-contain p-6"
                                />
                            ) : (
                                <div className="flex h-full min-h-80 items-center justify-center text-[var(--text-muted)]">
                                    <Wine size={56} />
                                </div>
                            )}
                        </div>
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                                Generated
                            </p>
                            <p className="mt-1 text-sm font-medium text-[var(--text)]">{generatedAt}</p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                {grapeVarieties.map((grape) => (
                                    <span
                                        key={grape}
                                        className="rounded-full border border-[var(--border)] bg-[var(--card-bg)] px-3 py-1 text-xs font-medium text-[var(--text)]"
                                    >
                                        {grape}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
                <section className="rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-5 sm:p-6">
                    <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
                        <div>
                            <SectionEyebrow icon={<BookOpen size={18} />} label="このワインを読む視点" />
                            <p className="mt-3 text-base leading-8 text-[var(--text)]">{explanation.lead}</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                            {takeaways.map((takeaway, index) => (
                                <div
                                    key={`${takeaway}-${index}`}
                                    className="border-l-4 border-[var(--primary)] bg-[var(--app-bg)] p-4"
                                >
                                    <p className="text-3xl font-bold text-[var(--primary)]">
                                        {String(index + 1).padStart(2, "0")}
                                    </p>
                                    <p className="mt-2 text-sm font-semibold leading-6 text-[var(--text)]">
                                        {takeaway}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
                    <Panel title="産地とテロワール" icon={<MapPin size={18} />}>
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
                                callouts={terroirCallouts}
                            />
                            {visualAssets.map?.caption && (
                                <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                                    {assetKindLabel(visualAssets.map)}: {visualAssets.map.caption}
                                </p>
                            )}
                        </div>
                        <p className="mt-4 text-sm leading-7 text-[var(--text)]">{explanation.terroir.summary}</p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <MiniInfo title="気候" value={explanation.terroir.climate} />
                            <MiniInfo title="土壌" value={explanation.terroir.soil} />
                        </div>
                        <TerroirInfluences items={explanation.terroir.influences} />
                    </Panel>

                    <Panel title="味わいの重心" icon={<Grape size={18} />}>
                        <p className="text-sm leading-7 text-[var(--text)]">{explanation.tasting.overview}</p>
                        <TasteRadar scales={explanation.tasting.scales} />
                        <div className="mt-5 space-y-5">
                            {asList(explanation.tasting.scales).map((scale) => (
                                <ScaleBar key={scale.label} scale={scale} />
                            ))}
                        </div>
                    </Panel>
                </section>

                <section className="grid gap-8 lg:grid-cols-3">
                    <Panel title="生産者" icon={<Wine size={18} />}>
                        <ProducerVisual asset={visualAssets.producer} producer={wine.producer || data.input.producer} />
                        <p className="text-sm leading-7 text-[var(--text)]">{explanation.producerStory.summary}</p>
                        <p className="mt-4 border-l-4 border-[var(--primary)] bg-[var(--app-bg)] p-4 text-sm leading-7 text-[var(--text)]">
                            {explanation.producerStory.philosophy}
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

                    <Panel title="造り" icon={<Sparkles size={18} />}>
                        <p className="text-sm leading-7 text-[var(--text)]">{explanation.winemaking.summary}</p>
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
                        <p className="text-sm leading-7 text-[var(--text)]">{explanation.vintage.summary}</p>
                        <div className="mt-5 space-y-3">
                            {asList(explanation.vintage.conditions).map((condition, index) => (
                                <NumberedNote key={`${condition}-${index}`} index={index + 1} text={condition} />
                            ))}
                        </div>
                    </Panel>
                </section>

                <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
                    <Panel title="香り・味わいの読み解き" icon={<Grape size={18} />}>
                        <AromaImageBoard asset={visualAssets.aromaBoard} />
                        <AromaVisualGrid aromas={aromaVisuals} />
                        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_0.8fr]">
                            <TastingColumn title="香りの根拠" items={explanation.tasting.aroma} />
                            <TastingColumn title="味わい" items={explanation.tasting.palate} />
                            <div className="rounded-xl border border-[var(--border)] bg-[var(--app-bg)] p-4">
                                <div className="flex items-center gap-2 text-sm font-bold text-[var(--text)]">
                                    <Clock3 size={16} className="text-[var(--primary)]" />
                                    余韻
                                </div>
                                <p className="mt-3 text-sm leading-7 text-[var(--text)]">{explanation.tasting.finish}</p>
                            </div>
                        </div>
                    </Panel>

                    <Panel title="サービス" icon={<Thermometer size={18} />}>
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
                                    <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">{point.description}</p>
                                </div>
                            ))}
                        </div>
                    </Panel>

                    <Panel title="参照範囲と出典" icon={<ExternalLink size={18} />}>
                        <div className="space-y-2">
                            {asList(explanation.sourceNotes).map((note, index) => (
                                <p key={`${note}-${index}`} className="rounded-lg bg-[var(--app-bg)] px-3 py-2 text-sm leading-6 text-[var(--text)]">
                                    {note}
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
        </main>
    );
}

function SectionEyebrow({ icon, label }: { icon: React.ReactNode; label: string }) {
    return (
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--primary)]">
            {icon}
            {label}
        </div>
    );
}

function FactTile({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
            <p className="mt-2 line-clamp-2 text-sm font-semibold leading-6 text-[var(--text)]">{value}</p>
        </div>
    );
}

function VisualSignalStrip({ items }: { items: { icon: React.ReactNode; label: string; value: string }[] }) {
    return (
        <div className="grid gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((item) => (
                <div key={`${item.label}-${item.value}`} className="flex items-center gap-3 rounded-xl bg-[var(--card-bg)] px-3 py-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--app-bg)] text-[var(--primary)]">
                        {item.icon}
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold text-[var(--text-muted)]">{item.label}</p>
                        <p className="truncate text-xs font-semibold text-[var(--text)]">{item.value}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}

function ProducerVisual({ asset, producer }: { asset?: VisualImageAsset; producer?: string }) {
    const src = assetUrl(asset);
    return (
        <div className="mb-5 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--app-bg)]">
            <div className="relative h-44 bg-[var(--surface-2)]">
                {src ? (
                    <img
                        src={src}
                        alt={`${producer || "生産者"} visual`}
                        className="h-full w-full object-cover"
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
                <div className="absolute left-3 top-3 rounded-full bg-[var(--card-bg)]/95 px-3 py-1 text-[10px] font-bold text-[var(--primary)] shadow-sm">
                    {assetKindLabel(asset) || "生産者イメージ"}
                </div>
            </div>
            <div className="space-y-2 p-3">
                {asset?.caption && (
                    <p className="text-xs leading-5 text-[var(--text)]">{asset.caption}</p>
                )}
                {asset?.sourceUrl && (
                    <a
                        href={asset.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)]"
                    >
                        <ExternalLink size={13} />
                        出典: {asset.sourceTitle || asset.sourceUrl}
                    </a>
                )}
            </div>
        </div>
    );
}

function TerroirMapVisual({
    asset,
    label,
    callouts,
}: {
    asset?: VisualImageAsset;
    label: string;
    callouts?: TerroirMapCallout[];
}) {
    const src = assetUrl(asset);
    if (src) {
        return (
            <div className="relative h-72 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card-bg)] sm:h-80">
                <img src={src} alt={label} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20" />
                <TerroirMapCallouts callouts={callouts} fallbackLabel={label} />
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
            <TerroirMapCallouts callouts={callouts} fallbackLabel={label} />
        </div>
    );
}

function TerroirMapCallouts({
    callouts,
    fallbackLabel,
}: {
    callouts?: TerroirMapCallout[];
    fallbackLabel: string;
}) {
    const list = asList(callouts).slice(0, 4);
    if (list.length === 0) {
        return (
            <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 rounded-xl bg-[var(--card-bg)]/95 px-3 py-2 text-xs font-bold text-[var(--text)] shadow-sm">
                <MapPin size={15} className="text-[var(--primary)]" />
                <span className="line-clamp-2">{fallbackLabel}</span>
            </div>
        );
    }

    const positionClass: Record<NonNullable<TerroirMapCallout["position"]>, string> = {
        "top-left": "left-3 top-3",
        "top-right": "right-3 top-3",
        "bottom-left": "bottom-3 left-3",
        "bottom-right": "bottom-3 right-3",
    };

    return (
        <div className="pointer-events-none absolute inset-0">
            {list.map((callout, index) => (
                <div
                    key={`${callout.label}-${index}`}
                    className={`absolute max-w-[46%] rounded-lg border border-white/30 bg-[var(--card-bg)]/95 px-2.5 py-2 text-[var(--text)] shadow-lg backdrop-blur ${positionClass[callout.position || "top-left"]}`}
                >
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--primary)]">
                        <TerroirCalloutIcon icon={callout.icon} />
                        <span className="truncate">{callout.label}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-[var(--text)]">
                        {callout.description}
                    </p>
                </div>
            ))}
        </div>
    );
}

function TerroirCalloutIcon({ icon }: { icon?: TerroirMapCallout["icon"] }) {
    switch (icon) {
        case "coast":
        case "river":
            return <Waves size={12} />;
        case "mountain":
            return <Mountain size={12} />;
        case "soil":
            return <Layers3 size={12} />;
        case "slope":
            return <Sprout size={12} />;
        case "climate":
            return <Sun size={12} />;
        default:
            return <MapPin size={12} />;
    }
}

function TerroirInfluences({ items }: { items?: { title: string; description: string }[] }) {
    const list = asList(items).slice(0, 3);
    if (list.length === 0) return null;

    const icons = [<Sun size={16} />, <CloudRain size={16} />, <Mountain size={16} />];
    return (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {list.map((item, index) => (
                <div key={`${item.title}-${index}`} className="rounded-xl border border-[var(--border)] bg-[var(--app-bg)] p-3">
                    <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--card-bg)] text-[var(--primary)]">
                        {icons[index % icons.length]}
                    </div>
                    <p className="text-sm font-bold text-[var(--text)]">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{item.description}</p>
                </div>
            ))}
        </div>
    );
}

function TasteRadar({ scales }: { scales?: VisualScale[] }) {
    const list = asList(scales).slice(0, 6);
    if (list.length < 3) return null;

    const center = 96;
    const radius = 68;
    const points = list.map((scale, index) => {
        const angle = -Math.PI / 2 + (index * 2 * Math.PI) / list.length;
        const value = Math.min(100, Math.max(0, Number(scale.value) || 0)) / 100;
        return {
            x: center + Math.cos(angle) * radius * value,
            y: center + Math.sin(angle) * radius * value,
            labelX: center + Math.cos(angle) * (radius + 22),
            labelY: center + Math.sin(angle) * (radius + 22),
            label: scale.label,
        };
    });
    const polygon = points.map((point) => `${point.x},${point.y}`).join(" ");

    return (
        <div className="mt-5 grid items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--app-bg)] p-4 sm:grid-cols-[210px_minmax(0,1fr)]">
            <svg viewBox="0 0 192 192" className="mx-auto h-48 w-48 overflow-visible">
                {[0.25, 0.5, 0.75, 1].map((step) => (
                    <circle
                        key={step}
                        cx={center}
                        cy={center}
                        r={radius * step}
                        fill="none"
                        stroke="var(--border)"
                        strokeWidth="1"
                    />
                ))}
                {points.map((point) => (
                    <line
                        key={`${point.label}-axis`}
                        x1={center}
                        y1={center}
                        x2={point.labelX - (point.labelX > center ? 12 : point.labelX < center ? -12 : 0)}
                        y2={point.labelY - (point.labelY > center ? 12 : point.labelY < center ? -12 : 0)}
                        stroke="var(--border)"
                        strokeWidth="1"
                    />
                ))}
                <polygon points={polygon} fill="var(--primary)" opacity="0.22" stroke="var(--primary)" strokeWidth="3" />
                {points.map((point) => (
                    <g key={point.label}>
                        <circle cx={point.x} cy={point.y} r="4" fill="var(--primary)" />
                        <text
                            x={point.labelX}
                            y={point.labelY}
                            textAnchor={point.labelX > center ? "start" : point.labelX < center ? "end" : "middle"}
                            dominantBaseline="middle"
                            fill="var(--text)"
                            fontSize="10"
                            fontWeight="700"
                        >
                            {point.label}
                        </text>
                    </g>
                ))}
            </svg>
            <div>
                <SectionEyebrow icon={<ScanSearch size={16} />} label="構造の見取り図" />
                <p className="mt-2 text-sm leading-7 text-[var(--text)]">
                    味わいの主要要素をレーダーで俯瞰します。棒グラフは各要素の根拠説明、レーダーは全体の重心を見るための補助図です。
                </p>
            </div>
        </div>
    );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center gap-3 border-b border-[var(--border)] pb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--app-bg)] text-[var(--primary)]">
                    {icon}
                </div>
                <h2 className="text-lg font-bold text-[var(--text)]">{title}</h2>
            </div>
            {children}
        </section>
    );
}

function MiniInfo({ title, value }: { title: string; value?: string }) {
    return (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4">
            <p className="text-xs font-bold text-[var(--primary)]">{title}</p>
            <p className="mt-2 text-sm leading-7 text-[var(--text)]">{value || "公開情報から確認中"}</p>
        </div>
    );
}

function IconInfo({ title, value, icon }: { title: string; value?: string; icon: React.ReactNode }) {
    return (
        <div className="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--app-bg)] text-[var(--primary)]">
                {icon}
            </div>
            <div>
                <p className="text-xs font-bold text-[var(--primary)]">{title}</p>
                <p className="mt-1 text-sm leading-6 text-[var(--text)]">{value || "公開情報から確認中"}</p>
            </div>
        </div>
    );
}

function AromaImageBoard({ asset }: { asset?: VisualImageAsset }) {
    const src = assetUrl(asset);
    if (!src) return null;

    return (
        <div className="mb-5 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--app-bg)]">
            <div className="relative h-56">
                <img src={src} alt={asset?.caption || "代表的な香りのイメージ"} className="h-full w-full object-cover" />
                <div className="absolute left-3 top-3 rounded-full bg-[var(--card-bg)]/95 px-3 py-1 text-[10px] font-bold text-[var(--primary)] shadow-sm">
                    {assetKindLabel(asset) || "香りイメージ"}
                </div>
            </div>
            {asset?.caption && (
                <p className="px-3 py-2 text-xs leading-5 text-[var(--text-muted)]">{asset.caption}</p>
            )}
        </div>
    );
}

function AromaVisualGrid({ aromas }: { aromas: AromaVisual[] }) {
    if (aromas.length === 0) return null;

    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {aromas.map((aroma) => (
                <div key={`${aroma.label}-${aroma.description}`} className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--app-bg)]">
                    <div className="relative h-28" style={{ background: `linear-gradient(135deg, ${aroma.color || "#be123c"} 0%, var(--card-bg) 78%)` }}>
                        <div className="absolute left-3 top-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--card-bg)]/95 text-[var(--primary)] shadow-sm">
                            <AromaIcon family={aroma.family} size={23} />
                        </div>
                        <div className="absolute bottom-3 right-3 flex gap-2 text-[var(--card-bg)]/80">
                            <CircleVisual />
                            <CircleVisual small />
                            <CircleVisual />
                        </div>
                    </div>
                    <div className="p-3">
                        <p className="text-sm font-bold text-[var(--text)]">{aroma.label}</p>
                        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{aroma.description}</p>
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

function ScaleBar({ scale }: { scale: VisualScale }) {
    const value = Math.min(100, Math.max(0, Number(scale.value) || 0));

    return (
        <div>
            <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                    <p className="font-bold text-[var(--text)]">{scale.label}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{scale.note}</p>
                </div>
                <span className="rounded-full bg-[var(--app-bg)] px-2.5 py-1 text-xs font-bold text-[var(--primary)]">
                    {value}
                </span>
            </div>
            <div className="relative h-3 rounded-full bg-[var(--app-bg)]">
                <div
                    className="absolute left-0 top-0 h-3 rounded-full bg-[var(--primary)]"
                    style={{ width: `${value}%` }}
                />
                <div
                    className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--card-bg)] bg-[var(--primary)] shadow-sm"
                    style={{ left: `${value}%` }}
                />
            </div>
            <div className="mt-1 flex justify-between text-xs text-[var(--text-muted)]">
                <span>{scale.lowLabel}</span>
                <span>{scale.highLabel}</span>
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
                <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{description}</p>
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
                <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{description}</p>
            </div>
        </div>
    );
}

function NumberedNote({ index, text }: { index: number; text: string }) {
    const icons = [<Sun size={16} />, <CloudRain size={16} />, <Thermometer size={16} />, <Droplets size={16} />, <Grape size={16} />, <BadgeInfo size={16} />];
    return (
        <div className="flex gap-3 rounded-xl bg-[var(--app-bg)] p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--card-bg)] text-[var(--primary)]">
                {icons[(index - 1) % icons.length]}
            </span>
            <p className="text-sm leading-6 text-[var(--text)]">{text}</p>
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
                        <span>{item}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

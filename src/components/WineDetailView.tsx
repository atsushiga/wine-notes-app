// Imports updated
import {
    round1,
    fruitStateLabel,
    oakAromaLabel,
    acidityLabel,
    tanninLabel,
    bodyLabel,
    finishLenLabel,
    worldLabel,
    intensityLabel,
    colorLabel,
    noseIntensityLabel,
    palateElementLabel,
    qualityLabel,
} from "@/lib/wineHelpers";
import { SAT_CONSTANTS } from '@/constants/sat';
import Link from 'next/link';
import ImageCarousel from './ImageCarousel';
import AiWineInfo from './AiWineInfo';

// ... (Props same)

export default function WineDetailView({ wine, onEdit, onDelete, isDeleting }: Props) {
    const wineType = wine.wine_type || "";
    // ... (booleans same)
    const isRed = wineType === '赤';
    const isWhite = wineType === '白';
    const isRose = wineType === 'ロゼ';
    const isOrange = wineType === 'オレンジ';
    const isSparklingWhite = wineType === '発泡白';
    const isSparklingRose = wineType === '発泡ロゼ';

    const renderScore = (value: number | undefined, labelFn: (v: number) => string) => {
        if (value === undefined || value === null) return "-";
        return `${round1(value)} (${labelFn(value)})`;
    };

    const renderSatScore = (value: number | undefined, options: readonly string[]) => {
        if (value === undefined || value === null) return "-";
        return `${value} (${getSatLabel(options, value)})`;
    };

    // getRimRatioLabel same...
    const getRimRatioLabel = (val: number | undefined) => {
        if (val === undefined || val === null) return "-";
        const v = round1(val);
        const comp = round1(10 - v);
        let labelLeft = '';
        let labelRight = '';
        if (isRed) { labelLeft = '紫'; labelRight = 'オレンジ'; }
        else if (isWhite || isSparklingWhite) { labelLeft = 'グリーン'; labelRight = 'ゴールド'; }
        else if (isRose || isSparklingRose) { labelLeft = 'ピンク'; labelRight = 'オレンジ'; }
        else if (isOrange) { labelLeft = '黄金'; labelRight = 'ブロンズ'; }
        else { labelLeft = '紫'; labelRight = 'オレンジ'; }
        return `${labelLeft} ${comp.toFixed(1)} : ${labelRight} ${v.toFixed(1)}`;
    };

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8 pb-32">
            {/* Header ... same */}
            <div className="flex items-center justify-between">
                <Link
                    href="/tasting-notes"
                    className="text-gray-500 hover:text-gray-900 flex items-center gap-1 text-sm transition-colors"
                >
                    ← 一覧に戻る
                </Link>
                <div className="flex items-center gap-4">
                    <div className="text-gray-400 text-sm">
                        {new Date(wine.created_at).toLocaleDateString("ja-JP")}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onEdit} className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">編集</button>
                        <button onClick={onDelete} disabled={isDeleting} className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">{isDeleting ? '削除中...' : '削除'}</button>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column ... same (Image/QuickStats) */}
                <div className="space-y-6">
                    <div className="bg-gray-100 rounded-2xl overflow-hidden shadow-sm">
                        {wine.images && wine.images.length > 0 ? (
                            <ImageCarousel images={wine.images} wineName={wine.wine_name || "Wine"} />
                        ) : (
                            // ... Image fallback same
                            <div className="relative aspect-[3/4] w-full">
                                {wine.image_url ? (
                                    <Image src={wine.image_url} alt={wine.wine_name || "Wine"} fill className="object-cover" />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-gray-300"><span className="text-6xl">🍷</span></div>
                                )}
                                {/* Rating Badge */}
                                {wine.rating !== undefined && (
                                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-md flex items-center gap-1 z-10">
                                        <span className="text-yellow-500 text-lg">★</span>
                                        <span className="text-lg font-bold text-gray-800">{round1(wine.rating)}</span>
                                    </div>
                                )}
                                {wine.wine_type && (
                                    <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-sm font-medium z-10">{wine.wine_type}</div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                        <h3 className="font-semibold text-gray-900 border-b pb-2">基本情報</h3>
                        <dl className="grid grid-cols-1 gap-y-3 text-sm">
                            {/* ... same stats ... */}
                            <div className="flex justify-between"><dt className="text-gray-500">ヴィンテージ</dt><dd className="font-medium">{wine.vintage || "-"}</dd></div>
                            <div className="flex justify-between"><dt className="text-gray-500">生産者</dt><dd className="font-medium text-right">{wine.producer || "-"}</dd></div>
                            {wine.importer && <div className="flex justify-between"><dt className="text-gray-500">輸入元</dt><dd className="font-medium text-right">{wine.importer}</dd></div>}
                            <div className="flex justify-between"><dt className="text-gray-500">国 / 地域</dt><dd className="font-medium text-right">{[wine.country, wine.locality || wine.region].filter(Boolean).join(" / ") || "-"}</dd></div>
                            <div className="flex justify-between"><dt className="text-gray-500">品種</dt><dd className="font-medium text-right">{[wine.main_variety, wine.other_varieties].filter(Boolean).join(", ") || "-"}</dd></div>
                            <div className="flex justify-between"><dt className="text-gray-500">価格</dt><dd className="font-medium">{wine.price ? `¥${wine.price.toLocaleString()}` : "-"}</dd></div>
                        </dl>
                    </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2 leading-tight">{wine.wine_name || "名称未設定"}</h1>
                        <p className="text-gray-500 text-sm">Reference ID: #{wine.id}</p>
                    </div>

                    {/* Conclusion (Quality) */}
                    <section className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">📝 総合評価</h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white p-3 rounded-xl border border-gray-100">
                                    <span className="block text-gray-600 text-xs mb-1">品質 (Quality)</span>
                                    <span className="font-bold text-gray-900">{renderScore(wine.quality_score, qualityLabel)}</span>
                                </div>
                                <div className="bg-white p-3 rounded-xl border border-gray-100">
                                    <span className="block text-gray-600 text-xs mb-1">熟成 (Readiness)</span>
                                    <span className="font-bold text-gray-900 text-sm">{wine.readiness || "-"}</span>
                                </div>
                            </div>
                            {wine.notes && (
                                <div className="bg-white p-4 rounded-xl border border-gray-100">
                                    <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">{wine.notes}</p>
                                </div>
                            )}
                            {wine.vivino_url && (
                                <a href={wine.vivino_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-[var(--accent)] hover:underline">
                                    Vivinoで見る ↗
                                </a>
                            )}
                        </div>
                    </section>

                    {/* Appearance */}
                    <section>
                        <h3 className="font-medium text-gray-900 border-b pb-2 mb-3">👁️ 外観</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="space-y-1"><span className="block text-xs text-gray-500">濃淡</span><span className="font-medium">{renderScore(wine.intensity, intensityLabel)}</span></div>
                            <div className="space-y-1"><span className="block text-xs text-gray-500">色調</span><span className="font-medium">{renderScore(wine.color as number, (v) => colorLabel(v, wineType))}</span></div>
                            <div className="space-y-1"><span className="block text-xs text-gray-500">縁の色調</span><span className="font-medium">{getRimRatioLabel(wine.rim_ratio)}</span></div>
                            <div className="space-y-1"><span className="block text-xs text-gray-500">清澄度</span><span className="font-medium">{wine.clarity || "-"}</span></div>
                            {wine.sparkle_intensity && <div className="space-y-1"><span className="block text-xs text-gray-500">泡の強さ</span><span className="font-medium">{wine.sparkle_intensity}</span></div>}
                        </div>
                        {wine.appearance_other && <p className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">{wine.appearance_other}</p>}
                    </section>

                    {/* Nose */}
                    <section>
                        <h3 className="font-medium text-gray-900 border-b pb-2 mb-3">👃 香り</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="space-y-1"><span className="block text-xs text-gray-500">コンディション</span><span className="font-medium">{wine.nose_condition || "-"}</span></div>
                            <div className="space-y-1"><span className="block text-xs text-gray-500">強さ</span><span className="font-medium">{renderScore(wine.nose_intensity, noseIntensityLabel)}</span></div>
                            <div className="space-y-1"><span className="block text-xs text-gray-500">熟成段階</span><span className="font-medium">{wine.development || "-"}</span></div>
                            <div className="space-y-1"><span className="block text-xs text-gray-500">樽香</span><span className="font-medium">{renderScore(wine.oak_aroma, oakAromaLabel)}</span></div>
                        </div>
                        {/* Optional old/new world etc */}
                        <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                            {(isRed || isRose || isOrange) && (
                                <>
                                    <div className="space-y-1"><span className="block text-xs text-gray-500">旧/新世界</span><span className="font-medium">{renderScore(wine.old_new_world, worldLabel)}</span></div>
                                    <div className="space-y-1"><span className="block text-xs text-gray-500">果実の状態</span><span className="font-medium">{renderScore(wine.fruits_maturity, fruitStateLabel)}</span></div>
                                </>
                            )}
                            {isWhite && (
                                <div className="space-y-1"><span className="block text-xs text-gray-500">ニュートラル/アロマティック</span><span className="font-medium">{wine.aroma_neutrality ? `${round1(wine.aroma_neutrality)}` : "-"}</span></div>
                            )}
                        </div>

                        {wine.aromas && wine.aromas.length > 0 && (
                            <div className="mt-3">
                                <span className="block text-xs text-gray-500 mb-1">アロマ</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {wine.aromas.map((aroma, i) => (
                                        <span key={i} className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">{aroma}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {wine.aroma_other && <p className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">{wine.aroma_other}</p>}
                    </section>

                    {/* Palate */}
                    <section>
                        <h3 className="font-medium text-gray-900 border-b pb-2 mb-3">👄 味わい</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                            <div className="space-y-1"><span className="block text-xs text-gray-500">甘味</span><span className="font-medium">{renderScore(wine.sweetness, (v) => palateElementLabel(v, 'sweetness'))}</span></div>
                            <div className="space-y-1"><span className="block text-xs text-gray-500">酸味</span><span className="font-medium">{renderScore(wine.acidity_score, (v) => palateElementLabel(v, 'acidity'))}</span></div>

                            {(isRed || isOrange) && (
                                <div className="space-y-1"><span className="block text-xs text-gray-500">タンニン</span><span className="font-medium">{renderScore(wine.tannin_score, (v) => palateElementLabel(v, 'tannin'))}</span></div>
                            )}

                            <div className="space-y-1"><span className="block text-xs text-gray-500">ボディ</span><span className="font-medium">{renderScore(wine.body_score, (v) => palateElementLabel(v, 'body'))}</span></div>
                            <div className="space-y-1"><span className="block text-xs text-gray-500">余韻</span><span className="font-medium">{renderScore(wine.finish_score, finishLenLabel)}</span></div>
                            <div className="space-y-1"><span className="block text-xs text-gray-500">アルコール度数</span><span className="font-medium">{wine.alcohol_abv ? `${round1(wine.alcohol_abv)}%` : "-"}</span></div>
                        </div>
                        {wine.palate_notes && <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded">{wine.palate_notes}</p>}
                    </section>

                    {/* Additional Info same... */}
                    {wine.additional_info && (
                        <section>
                            <h3 className="font-medium text-gray-900 border-b pb-2 mb-3">ℹ️ 補足情報</h3>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{wine.additional_info}</p>
                        </section>
                    )}
                </div>
            </div>
            {/* AI same ... */}
            <AiWineInfo wine={wine} />
        </div>
    );
}

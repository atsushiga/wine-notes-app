'use client';

import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { searchWineDetails, analyzeWineImage } from '@/app/actions/gemini';
import { Sparkles, Loader2, Eye, Wind, Grape, Award, Bot, ChevronDown, ChevronUp, BookOpen, User, Settings, Calendar, FileText } from 'lucide-react';
import { useState } from 'react';
import { SectionCard } from '@/components/ui/section-card';
import {
    colorLabel,
    intensityLabel,
    noseIntensityLabel,
    palateElementLabel,
    qualityLabel,
    finishLenLabel,
    oakAromaLabel,
    round1,
    worldLabel,
    fruitStateLabel,
} from '@/lib/wineHelpers';
import { generateThumbnail } from '@/lib/imageUtils';
import { WineImage } from '@/types/custom';
import { Trash2 } from 'lucide-react';
import { SAT_CONSTANTS } from '@/constants/sat';
import AromaSelector from '@/components/AromaSelector';
import { FieldRow } from '@/components/ui/field-row';

// === 定義：画像シートを意識した選択肢 ===
function removeUndefined(obj: Record<string, any>) {
    const newObj: Record<string, any> = {};
    for (const key in obj) {
        if (obj[key] !== undefined) {
            newObj[key] = obj[key];
        }
    }
    return newObj;
}

const apperance = {
    clarity: [
        { label: '澄んだ', score: 1 },
        { label: '深みのある', score: 0 },
        { label: 'やや濁った', score: -1 },
        { label: '濁った', score: -2 },
    ],
    brightness: [
        { label: '輝きのある', score: 1 },
        { label: '艶のある', score: 0 },
        { label: 'モヤがかった', score: -1 },
    ],
};

// ワインの種類
export const wineTypes = ['赤', '白', 'ロゼ', 'オレンジ', '発泡白', '発泡ロゼ'] as const;

export const countries = [
    'フランス', 'イタリア', 'スペイン', 'ドイツ', 'オーストリア', 'スイス',
    'アメリカ', 'カナダ', 'チリ', 'アルゼンチン', 'オーストラリア', 'ニュージーランド',
    '日本', '南アフリカ', 'ポルトガル', 'ギリシャ', 'ジョージア', 'その他'
] as const;

export const mainVarieties = [
    // 赤寄り
    'ピノ・ノワール', 'カベルネ・ソーヴィニヨン', 'メルロ', 'シラー/シラーズ',
    'サンジョヴェーゼ', 'ネッビオーロ', 'グルナッシュ', 'ジンファンデル', '赤その他',
    // 白寄り
    'シャルドネ', 'ソーヴィニヨン・ブラン', 'リースリング', 'シュナン・ブラン',
    'ピノ・グリ', 'ヴィオニエ', 'ゲヴュルツトラミネール', 'アルバリーニョ', '白その他'
] as const;

// 代表的アロマ (Legacy - moved to SAT_AROMA_DEFINITIONS in AromaSelector)

export const wineFormSchema = z.object({
    //テイスティング情報
    date: z.string(),
    price: z.string().optional().nullable(),          // 価格（任意）
    place: z.string().optional().nullable(),          // 飲んだ/購入した場所
    imageUrl: z.string().optional().nullable(),       // ひとまずURL（メイン画像 - 互換性のため残す、または先頭の画像を入れる）
    images: z.array(z.object({
        url: z.string(),
        thumbnail_url: z.string().optional(),
        storage_path: z.string().optional(),
        display_order: z.number().optional()
    })).optional().nullable(),

    // ワイン情報
    wineName: z.string().min(1),
    producer: z.string().optional().nullable(),
    country: z.string().optional().nullable(),        // セレクト
    locality: z.string().optional().nullable(),       // 自由記述（地名）
    region: z.string().optional().nullable(),
    mainVariety: z.string().optional().nullable(),    // 主体の品種（セレクト）
    otherVarieties: z.string().optional().nullable(), // 自由記述
    additionalInfo: z.string().optional().nullable(),
    vintage: z.string().optional().nullable(),
    importer: z.string().optional().nullable(),

    //外観
    wineType: z.enum(wineTypes),
    color: z.coerce.number().min(0).max(10).optional().nullable(), // SAT Color 0-10
    intensity: z.coerce.number().min(0).max(10).optional().nullable(), // SAT Intensity 0-10
    rimRatio: z.coerce.number().optional().nullable(), // Hidden
    clarity: z.string().optional().nullable(),
    brightness: z.string().optional().nullable(),
    sparkleIntensity: z.string().optional().nullable(),
    appearanceOther: z.string().optional().nullable(),

    //香り
    noseIntensity: z.coerce.number().min(0).max(10).optional().nullable(), // SAT 0-10
    noseCondition: z.enum(['不快 (Unclean)', '良好 (Clean)']).optional().nullable(),
    development: z.enum(['若い', '熟成中', '熟成した', 'ピークを過ぎた/疲れている']).optional().nullable(),

    oldNewWorld: z.coerce.number().min(1).max(5).optional().nullable(), // Keep 1-5 for now or update? Request only listed specific items. Keep as is.
    fruitsMaturity: z.coerce.number().min(1).max(5).optional().nullable(),
    aromaNeutrality: z.coerce.number().min(1).max(5).optional().nullable(),
    aromas: z.array(z.string()).optional().nullable(),
    oakAroma: z.coerce.number().min(1).max(5).optional().nullable(),
    aromaOther: z.string().optional().nullable(),

    //味わい
    sweetness: z.coerce.number().min(1).max(6).optional().nullable(), // SAT 1-6
    acidityScore: z.coerce.number().min(0).max(10).optional().nullable(), // SAT 0-10
    tanninScore: z.coerce.number().min(0).max(10).optional().nullable(), // SAT 0-10
    bodyScore: z.coerce.number().min(0).max(10).optional().nullable(), // SAT 0-10
    alcoholABV: z.coerce.number().min(0).max(100).optional().nullable(),
    finishScore: z.coerce.number().min(0).max(10).optional().nullable(), // SAT 0-10
    palateNotes: z.string().optional().nullable(),

    //総合評価
    qualityScore: z.coerce.number().min(0).max(10).optional().nullable(), // SAT 0-10
    readiness: z.string().optional().nullable(),

    rating: z.number().min(0).max(5),
    notes: z.string().optional().nullable(),
    vivinoUrl: z.string().optional().nullable(),

    // AI Fields
    terroir_info: z.string().optional().nullable(),
    producer_philosophy: z.string().optional().nullable(),
    technical_details: z.string().optional().nullable(),
    vintage_analysis: z.string().optional().nullable(),
    search_result_tasting_note: z.string().optional().nullable(),

    // Status
    status: z.enum(['published', 'draft']).optional().default('published'),
});

export type WineFormValues = z.infer<typeof wineFormSchema>;

interface WineFormProps {
    defaultValues?: Partial<WineFormValues>;
    onSubmit: (values: WineFormValues) => Promise<void>;
    isSubmitting?: boolean;
    submitLabel?: string;
    persistKey?: string; // New prop for persistence key
}

export default function WineForm({ defaultValues, onSubmit, isSubmitting, submitLabel = '保存する', persistKey }: WineFormProps) {
    const { register, handleSubmit, control, watch, setValue, getValues, reset, formState: { errors } } = useForm<WineFormValues>({
        defaultValues: {
            date: '',
            place: '',
            price: '',
            imageUrl: '',
            images: [],

            wineType: '赤',
            wineName: '',
            producer: '',
            country: '',
            locality: '',
            region: '',
            mainVariety: '',
            otherVarieties: '',
            vintage: '2022',
            additionalInfo: '',

            intensity: 5.0, // Default Med
            color: 5.0,
            rimRatio: 5.0,
            clarity: '澄んだ',
            brightness: '輝きのある',
            sparkleIntensity: '',
            appearanceOther: '',

            noseIntensity: 5.0, // Default Med
            noseCondition: '良好 (Clean)',
            development: '若い',
            oldNewWorld: 3.0,
            aromaNeutrality: 3.0,
            fruitsMaturity: 1.0,
            oakAroma: 1,
            aromas: [],
            aromaOther: '',

            sweetness: 1.0, // Dry
            acidityScore: 5.0, // Med
            tanninScore: 5.0,
            bodyScore: 5.0,
            alcoholABV: 12.5,
            finishScore: 5.0,
            palateNotes: '',

            qualityScore: 5.0, // Good
            readiness: '今飲めるが熟成可能',
            rating: 3.5,
            notes: '',



            terroir_info: '',
            producer_philosophy: '',
            technical_details: '',
            vintage_analysis: '',
            search_result_tasting_note: '',
            status: 'published',
            ...(defaultValues ? removeUndefined(defaultValues) : {})
        },
        resolver: zodResolver(wineFormSchema) as any
    });

    // --- Persistence Logic ---
    useEffect(() => {
        if (!persistKey) return;

        // Load from sessionStorage on mount (tab specific)
        const saved = sessionStorage.getItem(persistKey);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);

                // Re-calculate date if not saved or safeguard it
                if (!parsed.date && !getValues('date')) {
                    const d = new Date();
                    const yyyy = d.getFullYear();
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const dd = String(d.getDate()).padStart(2, '0');
                    parsed.date = `${yyyy}-${mm}-${dd}`;
                }

                Object.keys(parsed).forEach((key) => {
                    // explicit typing for key
                    const k = key as keyof WineFormValues;
                    if (parsed[k] !== undefined && parsed[k] !== null) {
                        setValue(k, parsed[k]);
                    }
                });

            } catch (e) {
                console.error("Failed to parse saved draft", e);
            }
        }
    }, [persistKey, setValue]);

    // Save to sessionStorage on change
    useEffect(() => {
        if (!persistKey) return;
        const subscription = watch((value) => {
            sessionStorage.setItem(persistKey, JSON.stringify(value));
        });
        return () => subscription.unsubscribe();
    }, [watch, persistKey]);

    // Clear storage on successful submit is handled by the parent or we can do it here if we wrap onSubmit.
    // Since onSubmit is passed in, let's wrap it.
    const handleFormSubmit = async (data: WineFormValues) => {
        await onSubmit(data); // wait for parent action
        // If successful
        if (persistKey) {
            sessionStorage.removeItem(persistKey);
        }
        // Reset the form to initial state to clear inputs
        // We have to re-initialize with default values effectively.
        // We can use the reset() function from hook-form.
        // We pass defaultValues or empty object to clear.

        // However, we want to keep the 'date' as today probably?
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');

        const nextDefaults: Partial<WineFormValues> = {
            date: `${yyyy}-${mm}-${dd}`,
            //... other defaults if needed, but the form defaults in useForm will be used if we just reset?
            // reset(values, options) -> if we pass new values it sets them.
            // if we pass nothing, it resets to *defaultValues* passed to useForm?
        };

        // Actually, we defined defaultValues in useForm.
        // reset() without args resets to the original defaultValues.
        // But our defaultValues logic for 'date' was inside useForm config.
        // Let's explicitly reset to a clean state.

        // We need to merge the hardcoded defaults in useForm with the dynamic date.

        // Simpler approach:
        // Just call reset();

        // But wait, the date logic (useEffect) might run again?
        // "useEffect(() => { if (!getValues('date')) ... })"

        // If we reset(), the values become the original defaultValues.
        // If original defaultValues had empty date, the effect will run?
        // The effect runs on mount or getValues/setValue change.

        // If we simply reload the page? NO, that's not good UX.

        // reset() restores to `defaultValues`.
        // In this component, `defaultValues` prop is passed.
        // And inside, we have a fallback object.

        // We can just construct a fresh default object.
        const freshDefaults: WineFormValues = {
            date: `${yyyy}-${mm}-${dd}`,
            place: '',
            price: '',

            imageUrl: '',
            images: [],
            wineType: '赤',
            wineName: '',
            producer: '',
            country: '',
            locality: '',
            region: '',
            mainVariety: '',
            otherVarieties: '',
            vintage: '2022',
            additionalInfo: '',
            importer: '',

            intensity: 2.0,
            color: undefined,
            rimRatio: 5.0,
            clarity: '澄んだ',
            brightness: '輝きのある',
            sparkleIntensity: '',
            appearanceOther: '',

            noseIntensity: 3.0,
            noseCondition: '良好 (Clean)',
            development: '若い',
            oldNewWorld: 3.0,
            aromaNeutrality: 3.0,
            fruitsMaturity: 3.0,
            oakAroma: 1,
            aromas: [],
            aromaOther: '',

            sweetness: 1.0,
            acidityScore: 3.0,
            tanninScore: 3.0,
            bodyScore: 3.0,
            alcoholABV: 12.5,
            finishScore: 5.0, // Default Med (5/10)
            palateNotes: '',

            qualityScore: 3.0,
            readiness: '今飲めるが熟成可能',
            rating: 3.0,
            notes: '',


            terroir_info: '',
            producer_philosophy: '',
            technical_details: '',
            vintage_analysis: '',
            search_result_tasting_note: '',
            status: 'published',
        };

        // @ts-ignore - reset expects partial or values depending on version, strict type match might fail on undefineds but we can cast or just use what we have.
        // Actually hook form reset can take values.

        // We need to bring in the `reset` function from `useForm`.
        reset(freshDefaults);

        // Also clear any "search result" state
        setIsAiExpanded(false);
    };

    const handleClear = () => {
        if (!confirm('入力内容を全てクリアしますか？')) return;

        if (persistKey) {
            sessionStorage.removeItem(persistKey);
        }

        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');

        reset({
            date: `${yyyy}-${mm}-${dd}`,
            // We need to provide minimal defaults to satisfy types if needed, or let partial works
            // Providing complete fresh defaults is safest
            place: '',
            price: '',
            imageUrl: '',
            images: [],
            wineType: '赤',
            wineName: '',
            producer: '',
            country: '',
            locality: '',
            region: '',
            mainVariety: '',
            otherVarieties: '',
            vintage: '2022',
            additionalInfo: '',
            intensity: 2.0,
            rimRatio: 5.0,
            clarity: '澄んだ',
            brightness: '輝きのある',
            sparkleIntensity: '',
            appearanceOther: '',
            noseIntensity: 3,
            noseCondition: '良好 (Clean)',
            development: '若い',
            oldNewWorld: 3.0,
            aromaNeutrality: 3.0,
            fruitsMaturity: 1.0,
            oakAroma: 1,
            aromas: [],
            aromaOther: '',
            sweetness: 1,
            acidityScore: 3.0,
            tanninScore: 3.0,
            bodyScore: 3.0,
            alcoholABV: 12.5,
            finishScore: 3,
            palateNotes: '',
            qualityScore: 3,
            readiness: '今飲めるが熟成可能',
            rating: 3.5,
            notes: '',

            terroir_info: '',
            producer_philosophy: '',
            technical_details: '',
            vintage_analysis: '',
            search_result_tasting_note: '',
            status: 'published',
        } as WineFormValues);

        setIsAiExpanded(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSaveDraft = async (e: React.MouseEvent) => {
        // Prevent default submit
        e.preventDefault();
        setValue('status', 'draft');
        await handleSubmit(handleFormSubmit)();
    };

    const handlePublish = () => {
        setValue('status', 'published');
    };

    const wineType = watch('wineType');
    const wineNameValue = watch('wineName');
    const hasWineName = !!wineNameValue;

    useEffect(() => {
        document.body.setAttribute('data-winetype', wineType ?? '');
    }, [wineType]);

    const isRed = wineType === '赤';
    const isWhite = wineType === '白';
    const isRose = wineType === 'ロゼ';
    const isOrange = wineType === 'オレンジ';
    const isSparklingWhite = wineType === '発泡白';
    const isSparklingRose = wineType === '発泡ロゼ';

    useEffect(() => {
        if (!getValues('date')) {
            const d = new Date();
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            setValue('date', `${yyyy}-${mm}-${dd}`, { shouldDirty: false });
        }
    }, [getValues, setValue]);

    // const filteredAromaGroups = ... (Removed legacy filtering logic)

    const uploadFile = async (file: File | Blob, filename: string): Promise<string> => {
        const payload = {
            filename: filename,
            contentType: file.type || 'application/octet-stream',
        };
        const r = await fetch('/api/upload-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const { putUrl, getUrl, error } = await r.json();
        if (error) throw new Error(error);

        const res = await fetch(putUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type || 'application/octet-stream' },
            body: file,
        });
        if (!res.ok) throw new Error('Upload failed');
        return getUrl;
    };

    const handleFilesSelect = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        const newImages: { url: string; thumbnail_url?: string; display_order: number }[] = [];
        const currentImages = getValues('images') || [];
        let orderOffset = currentImages.length;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                // 1. Generate Thumbnail
                const thumbnailBlob = await generateThumbnail(file, 400); // slightly larger max just in case

                // 2. Upload Original
                const originalUrl = await uploadFile(file, file.name);

                // 3. Upload Thumbnail
                // naming hack for thumbnail: prefix or suffix
                const thumbName = `thumb_${file.name}`;
                const thumbUrl = await uploadFile(thumbnailBlob, thumbName);

                newImages.push({
                    url: originalUrl,
                    thumbnail_url: thumbUrl,
                    display_order: orderOffset + i
                });

                // If this is the first image ever, set it as main imageUrl for compatibility
                if (orderOffset === 0 && i === 0 && !getValues('imageUrl')) {
                    setValue('imageUrl', originalUrl, { shouldDirty: true });
                }

            } catch (err) {
                console.error("File upload error:", err);
                alert(`Upload failed for ${file.name}: ${String(err)}`);
            }
        }

        if (newImages.length > 0) {
            setValue('images', [...currentImages, ...newImages], { shouldDirty: true });
        }
    };

    const removeImage = (index: number) => {
        const current = getValues('images') || [];
        const next = current.filter((_, i) => i !== index);
        setValue('images', next, { shouldDirty: true });

        // Update mainImageUrl if needed using the first remaining image
        if (next.length > 0) {
            setValue('imageUrl', next[0].url, { shouldDirty: true });
        } else {
            setValue('imageUrl', '', { shouldDirty: true });
        }
    };

    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isAiExpanded, setIsAiExpanded] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);



    const handleAiSearch = async () => {
        const name = getValues('wineName');
        const producer = getValues('producer');
        const vintage = getValues('vintage');

        if (!name) {
            alert('ワイン名を入力してください');
            return;
        }

        setIsAiLoading(true);
        try {
            const result = await searchWineDetails(0, { // ID 0 as dummy for new/unsaved
                name,
                winery: producer || undefined,
                vintage: vintage || undefined,
            });

            setIsAiExpanded(true);
            setValue('terroir_info', result.terroir_info, { shouldDirty: true });
            setValue('producer_philosophy', result.producer_philosophy, { shouldDirty: true });
            setValue('technical_details', result.technical_details, { shouldDirty: true });
            setValue('vintage_analysis', result.vintage_analysis, { shouldDirty: true });
            setValue('search_result_tasting_note', result.search_result_tasting_note, { shouldDirty: true });
        } catch (e) {
            console.error(e);
            alert('AI検索に失敗しました');
        } finally {
            setIsAiLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)} className="mx-auto w-full max-w-xl px-4 pb-24 md:max-w-2xl space-y-8">
            <div className="flex justify-between items-center bg-gray-50 px-4 py-2 rounded-lg mb-4">
                <span className="text-sm text-gray-500">入力フォーム</span>
                <button
                    type="button"
                    onClick={handleClear}
                    className="text-xs text-red-500 hover:text-red-700 underline"
                >
                    入力内容をクリア
                </button>
            </div>

            {/* タブ：ワインタイプ */}
            <section className="mb-4">
                <div className="flex flex-wrap gap-2">
                    {wineTypes.map(t => {
                        const active = wineType === t;
                        return (
                            <button
                                key={t}
                                type="button"
                                className={`px-3 py-1.5 rounded-full border ${active ? 'bg-black text-white' : 'bg-white'}`}
                                onClick={() => setValue('wineType', t, { shouldDirty: true })}
                            >
                                {t}
                            </button>
                        );
                    })}
                </div>
                <input type="hidden" {...register('wineType')} />
            </section>

            {/* 基本情報 */}
            <SectionCard title="基本情報" icon={<Calendar size={18} />} tone="neutral">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <FieldRow label="日付">
                        <input type="date" className="w-full input" {...register('date')} />
                    </FieldRow>
                    <FieldRow label="飲んだ/購入した場所">
                        <input className="w-full input" placeholder="例: 自宅 / ○○レストラン / △△ワインショップ"
                            {...register('place')} />
                    </FieldRow>
                </div>
                <div className="mt-6">
                    <label className="block text-sm font-medium text-zinc-700 mb-2">写真（複数選択可）</label>
                    <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="block w-full text-sm text-slate-500 rounded-full border border-gray-300 p-2"
                        onChange={(e) => {
                            handleFilesSelect(e.target.files);
                            // Clear input so same files can be selected again if needed? 
                            // e.target.value = ''; // Be careful with this in react
                        }}
                    />
                </div>

                {/* Image Preview Grid */}
                {(watch('images')?.length ?? 0) > 0 && (
                    <div className="sm:col-span-3 mt-2 grid grid-cols-3 sm:grid-cols-4 gap-4">
                        {watch('images')?.map((img, idx) => (
                            <div key={idx} className="relative group aspect-square bg-gray-100 rounded-lg overflow-hidden border">
                                <img
                                    src={img.thumbnail_url || img.url}
                                    alt={`upload-${idx}`}
                                    className="w-full h-full object-cover"
                                />
                                <button
                                    type="button"
                                    onClick={() => removeImage(idx)}
                                    className="absolute top-1 right-1 bg-white/80 p-1 rounded-full text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}


                {/* Legacy/Main Image Preview for AI Search (kept hidden or separate?)
                    Let's allow selecting one image for AI search from the uploaded list
                */}

                {watch('imageUrl') && (
                    <div className="sm:col-span-3 mt-2">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-gray-500">AI解析用メイン画像:</span>
                            {!watch('images') || watch('images')?.length === 0 ? (
                                <img src={watch('imageUrl')!} alt="main" className="h-10 w-10 object-cover rounded border" />
                            ) : null}
                        </div>

                        <div className="mt-2">
                            <button
                                type="button"
                                onClick={async () => {
                                    const url = getValues('imageUrl');
                                    if (!url) return;

                                    try {
                                        setIsAnalyzing(true);
                                        const result = await analyzeWineImage(url);
                                        if (result) {
                                            if (result.wineName) setValue('wineName', result.wineName, { shouldDirty: true });
                                            if (result.producer) setValue('producer', result.producer, { shouldDirty: true });
                                            if (result.vintage) setValue('vintage', result.vintage, { shouldDirty: true });
                                            if (result.country) setValue('country', result.country, { shouldDirty: true });
                                            if (result.locality) setValue('locality', result.locality, { shouldDirty: true });
                                            if (result.price) setValue('price', String(result.price), { shouldDirty: true });
                                        }
                                    } catch (e) {
                                        console.error(e);
                                        alert('画像解析に失敗しました');
                                    } finally {
                                        setIsAnalyzing(false);
                                    }
                                }}
                                disabled={isAnalyzing}
                                className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-md shadow-sm hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                AI銘柄検索
                            </button>
                            <p className="text-[10px] text-gray-400 mt-1">※画像からワイン情報を自動推定します</p>
                        </div>
                    </div>
                )}


            </SectionCard>


            {/* ワイン情報 */}
            <SectionCard title="ワイン情報" icon={<FileText size={18} />} tone="neutral">
                <div className='grid grid-cols-1 gap-6'>
                    <FieldRow label="ワイン名*" hint="例: Domaine X, cuvée">
                        <input className="w-full input" placeholder="Wine name" {...register('wineName')} />
                        {errors.wineName && <p className="text-red-600 text-sm mt-1">必須です</p>}
                    </FieldRow>

                    <div className="grid sm:grid-cols-2 gap-6">
                        <FieldRow label="生産者">
                            <input className="w-full input" {...register('producer')} />
                        </FieldRow>
                        <FieldRow label="ヴィンテージ">
                            <input className="w-full input" placeholder="例: 2021" {...register('vintage')} />
                        </FieldRow>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-6">
                        <Controller
                            control={control}
                            name="price"
                            render={({ field }) => {
                                const value = field.value ?? '';
                                const formatted =
                                    value !== '' && !isNaN(Number(value))
                                        ? Number(value).toLocaleString()
                                        : '';

                                return (
                                    <FieldRow label="ボトル価格">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                inputMode='numeric'
                                                className="flex-1 input text-right"
                                                value={formatted}
                                                onChange={(e) => {
                                                    const raw = e.target.value.replace(/[^\d]/g, '');
                                                    field.onChange(raw);
                                                }}
                                                autoComplete="off" autoCorrect="off" autoCapitalize="none"
                                                placeholder="4,500"
                                            />
                                            <span className="text-gray-600">円</span>
                                        </div>
                                    </FieldRow>
                                );
                            }}

                        />
                        <FieldRow label="輸入元">
                            <input className="w-full input" placeholder="Importer" {...register('importer')} />
                        </FieldRow>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-6">
                        <FieldRow label="色">
                            <input
                                type="text"
                                value={watch('wineType') ?? ''}
                                readOnly
                                className="w-full input bg-gray-50 text-gray-700 cursor-default"
                            />
                        </FieldRow>
                        <div />
                    </div>

                    <div className="pt-2 border-t border-dashed border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-900 mb-4">生産地</h4>
                        <div className="grid sm:grid-cols-2 gap-6">
                            <FieldRow label="国">
                                <select className="w-full input" {...register('country')}>
                                    <option value="">未選択</option>
                                    {countries.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </FieldRow>
                            <FieldRow label="地名（地域/村/畑など）">
                                <input className="w-full input" placeholder="例: ブルゴーニュ／ニュイ＝サン＝ジョルジュ／レ・ダモード"
                                    {...register('locality')} />
                            </FieldRow>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-dashed border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-900 mb-4">品種</h4>
                        <div className="grid sm:grid-cols-2 gap-6">
                            <FieldRow label="主体の品種">
                                <select className="w-full input" {...register('mainVariety')}>
                                    <option value="">未選択</option>
                                    {mainVarieties.map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                            </FieldRow>
                            <FieldRow label="その他（補助品種・ブレンド等）">
                                <input className="w-full input" placeholder="例: プティ・ヴェルド 5% など"
                                    {...register('otherVarieties')} />
                            </FieldRow>
                        </div>
                    </div>

                    <div className="pt-2">
                        <FieldRow label="補足情報（自由入力）">
                            <textarea
                                className="w-full input h-28"
                                placeholder="例: 畑情報、区画、樹齢、醸造メモ、輸入元メモ、保存環境 など自由に"
                                {...register('additionalInfo')}
                            />
                        </FieldRow>
                    </div>
                </div>
            </SectionCard>



            {/* 外観 */}
            <SectionCard
                title="外観"
                description="色、清澄度、濃淡の評価"
                icon={<Eye size={18} />}
                tone="neutral"
            >
                <div className="grid sm:grid-cols-2 gap-6">
                    <FieldRow label="清澄度">
                        <select
                            className="w-full rounded-md px-3 py-2 bg-[var(--surface)] text-[var(--fg)] border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                            {...register('clarity')}
                        >
                            {apperance.clarity.map(v => (
                                <option key={v.label} value={v.label}>{v.label}</option>
                            ))}
                        </select>
                    </FieldRow>
                    <FieldRow label="輝き">
                        <select className="w-full input" {...register('brightness')}>
                            {apperance.brightness.map(v => (
                                <option key={v.label} value={v.label}>{v.label}</option>
                            ))}
                        </select>
                    </FieldRow>
                </div>

                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-8 mt-8">
                    <Controller
                        control={control}
                        name="intensity"
                        render={({ field }) => {
                            const v = Number(field.value ?? 5);
                            return (
                                <FieldRow
                                    label="濃淡 (Intensity)"
                                    valueText={`${v}: ${intensityLabel(v)}`}
                                >
                                    <input
                                        type="range"
                                        min={0}
                                        max={10}
                                        step={0.5}
                                        value={v}
                                        onChange={(e) => field.onChange(Number(e.target.value))}
                                        className="w-full accent-gray-700"
                                    />
                                    <div className="flex justify-between text-xs text-gray-400 px-1 mt-1">
                                        <span>淡</span><span>濃</span>
                                    </div>
                                </FieldRow>
                            );
                        }}
                    />
                    <Controller
                        control={control}
                        name="color"
                        render={({ field }) => {
                            const v = Number(field.value ?? 5);
                            return (
                                <FieldRow
                                    label="色調 (Color)"
                                    valueText={`${v}: ${colorLabel(v, wineType)}`}
                                >
                                    <input
                                        type="range"
                                        min={0}
                                        max={10}
                                        step={0.5}
                                        value={v}
                                        onChange={(e) => field.onChange(Number(e.target.value))}
                                        className="w-full accent-gray-700"
                                    />
                                    <div className="flex justify-between text-xs text-gray-400 px-1 mt-1">
                                        <span>淡/緑</span><span>濃/褐</span>
                                    </div>
                                </FieldRow>
                            );
                        }}
                    />
                </div>

                {/* Rim Ratio (Hidden from form as requested) */}

                {(isSparklingWhite || isSparklingRose) && (
                    <div className='mt-6'>
                        <FieldRow label="泡の強さ">
                            <select
                                className="w-full rounded-md px-3 py-2 bg-[var(--surface)] text-[var(--fg)] border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                                {...register('sparkleIntensity')}
                            >
                                {['弱い', 'やや弱い', '中程度', 'やや強い', '強い'].map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                        </FieldRow>
                    </div>
                )}

                <div className='mt-6'>
                    <FieldRow label="その他の外観の特徴" hint="例: 泡のきめ細かさ、涙、濁り、ガス感、粘性 など">
                        <textarea
                            className="w-full h-24 rounded-md px-3 py-2 bg-[var(--surface)] text-[var(--fg)] border border-[var(--border)] placeholder-[var(--fg-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                            {...register('appearanceOther')}
                        />
                    </FieldRow>
                </div>
            </SectionCard>

            {/* 香り */}
            <SectionCard
                title="香り"
                description="強さ、質、特徴の分析"
                icon={<Wind size={18} />}
                tone="soft"
            >

                <div className="grid sm:grid-cols-2 gap-6">
                    <FieldRow label="コンディション">
                        <select className="w-full input" {...register('noseCondition')}>
                            {SAT_CONSTANTS.NOSE.CONDITION.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </FieldRow>
                    <FieldRow label="熟成段階">
                        <select className="w-full input" {...register('development')}>
                            {SAT_CONSTANTS.NOSE.DEVELOPMENT.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </FieldRow>
                </div>

                <div className="space-y-8 mt-8">
                    <div>
                        <Controller
                            control={control}
                            name="noseIntensity"
                            render={({ field }) => {
                                const v = Number(field.value ?? 5);
                                return (
                                    <FieldRow
                                        label="香りの強さ"
                                        valueText={`${v}: ${noseIntensityLabel(v)}`}
                                    >
                                        <input
                                            type="range"
                                            min={0}
                                            max={10}
                                            step={0.5}
                                            value={v}
                                            onChange={(e) => field.onChange(Number(e.target.value))}
                                            className="w-full accent-zinc-700"
                                        />
                                        <div className="flex justify-between text-xs text-zinc-300 px-1 mt-1">
                                            <span>弱</span><span>強</span>
                                        </div>
                                    </FieldRow>
                                );
                            }}
                        />
                    </div>

                    {/* Legacy / Auxiliary Sliders */}
                    {(isRed || isRose || isOrange) && (
                        <div>
                            <Controller
                                control={control}
                                name="oldNewWorld"
                                render={({ field }) => {
                                    const v = round1(Number(field.value ?? 3));
                                    return (
                                        <FieldRow
                                            label="旧/新世界"
                                            valueText={`${v.toFixed(1)}: ${v <= 3 ? '旧世界' : '新世界'}`}
                                        >
                                            <input
                                                type="range"
                                                min={1}
                                                max={5}
                                                step={0.1}
                                                value={v}
                                                onChange={(e) => field.onChange(Number(e.target.value))}
                                                className="w-full accent-zinc-700"
                                            />
                                            <div className="flex justify-between text-xs text-zinc-300 px-1 mt-1">
                                                <span>旧世界</span><span>新世界</span>
                                            </div>
                                        </FieldRow>
                                    );
                                }}
                            />
                        </div>
                    )}

                    {isWhite && (
                        <div>
                            <Controller
                                control={control}
                                name="aromaNeutrality"
                                render={({ field }) => {
                                    const v = round1(Number(field.value ?? 3));
                                    return (
                                        <FieldRow
                                            label="ニュートラル / アロマティック"
                                            valueText={`${v.toFixed(1)}: ${v <= 3 ? 'ニュートラル' : 'アロマティック'}`}
                                        >
                                            <input
                                                type="range"
                                                min={1}
                                                max={5}
                                                step={0.1}
                                                value={v}
                                                onChange={(e) => field.onChange(Number(e.target.value))}
                                                className="w-full accent-zinc-700"
                                            />
                                            <div className="flex justify-between text-xs text-zinc-300 px-1 mt-1">
                                                <span>ニュートラル</span><span>アロマティック</span>
                                            </div>
                                        </FieldRow>
                                    );
                                }}
                            />
                        </div>
                    )}

                    <div className="pt-2">
                        <Controller
                            control={control}
                            name="oakAroma"
                            render={({ field }) => {
                                const v = Math.round((field.value ?? 1) * 10) / 10;
                                return (
                                    <FieldRow
                                        label="樽香"
                                        valueText={`${v.toFixed(1)}: ${oakAromaLabel(v)}`}
                                    >
                                        <input
                                            type="range"
                                            min={1}
                                            max={5}
                                            step={0.5}
                                            value={v}
                                            onChange={(e) => field.onChange(Number(e.target.value))}
                                            className="w-full accent-zinc-700"
                                        />
                                        <div className="flex justify-between text-xs text-zinc-300 px-1 mt-1">
                                            <span>弱</span><span>強</span>
                                        </div>
                                    </FieldRow>
                                );
                            }}
                        />
                    </div>
                </div>

                <div className="space-y-3 mt-10 border-t border-gray-100 pt-6">
                    <p className="text-sm font-semibold text-zinc-800">印象（アロマ）</p>
                    <Controller
                        control={control}
                        name="aromas"
                        render={({ field }) => (
                            <div className="space-y-4">
                                <AromaSelector
                                    selectedAromas={field.value || []}
                                    onChange={(newAromas) => field.onChange(newAromas)}
                                />
                            </div>
                        )}
                    />
                </div>
                <div className="mt-4">
                    <label className="block text-sm font-medium mb-1">その他のアロマ</label>
                    <textarea
                        className="w-full input h-20"
                        placeholder="例: バター、ナッツ、蜂蜜、ペトロール、ミネラルなど自由に記載"
                        {...register('aromaOther')}
                    />
                </div>

            </SectionCard>

            {/* 味わい */}
            <SectionCard
                title="味わい"
                description="甘味、酸味、タンニン、ボディ、余韻"
                icon={<Grape size={18} />}
                tone="soft"
            >

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Sweetness */}
                    <FieldRow label="甘味">
                        <select className="w-full input" {...register('sweetness')}>
                            {SAT_CONSTANTS.PALATE.SWEETNESS.map((label, index) => (
                                <option key={label} value={index + 1}>{label}</option>
                            ))}
                        </select>
                    </FieldRow>

                    {/* Acidity */}
                    <Controller
                        control={control}
                        name="acidityScore"
                        render={({ field }) => {
                            const v = Number(field.value ?? 5);
                            return (
                                <FieldRow
                                    label="酸味"
                                    valueText={`${v}: ${palateElementLabel(v, 'acidity')}`}
                                >
                                    <input
                                        type="range"
                                        min={0}
                                        max={10}
                                        step={0.5}
                                        value={v}
                                        onChange={(e) => field.onChange(Number(e.target.value))}
                                        className="w-full accent-gray-700"
                                    />
                                    <div className="flex justify-between text-xs text-gray-400 px-1 mt-1">
                                        <span>低</span><span>高</span>
                                    </div>
                                </FieldRow>
                            );
                        }}
                    />

                    {/* Tannin */}
                    {(isRed || isOrange) && (
                        <Controller
                            control={control}
                            name="tanninScore"
                            render={({ field }) => {
                                const v = Number(field.value ?? 5);
                                return (
                                    <FieldRow
                                        label="タンニン"
                                        valueText={`${v}: ${palateElementLabel(v, 'tannin')}`}
                                    >
                                        <input
                                            type="range"
                                            min={0}
                                            max={10}
                                            step={0.5}
                                            value={v}
                                            onChange={(e) => field.onChange(Number(e.target.value))}
                                            className="w-full accent-gray-700"
                                        />
                                        <div className="flex justify-between text-xs text-gray-400 px-1 mt-1">
                                            <span>低</span><span>高</span>
                                        </div>
                                    </FieldRow>
                                );
                            }}
                        />
                    )}

                    {/* Alcohol */}
                    <FieldRow label="アルコール度数">
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                step="0.1"
                                className="w-full input text-right"
                                {...register('alcoholABV', { valueAsNumber: true })}
                                placeholder="12.5"
                            />
                            <span className="text-sm">%</span>
                        </div>
                    </FieldRow>

                    {/* Body */}
                    <Controller
                        control={control}
                        name="bodyScore"
                        render={({ field }) => {
                            const v = Number(field.value ?? 5);
                            return (
                                <FieldRow
                                    label="ボディ"
                                    valueText={`${v}: ${palateElementLabel(v, 'body')}`}
                                >
                                    <input
                                        type="range"
                                        min={0}
                                        max={10}
                                        step={0.5}
                                        value={v}
                                        onChange={(e) => field.onChange(Number(e.target.value))}
                                        className="w-full accent-gray-700"
                                    />
                                    <div className="flex justify-between text-xs text-gray-400 px-1 mt-1">
                                        <span>軽</span><span>重</span>
                                    </div>
                                </FieldRow>
                            );
                        }}
                    />

                    {/* Finish */}
                    <Controller
                        control={control}
                        name="finishScore"
                        render={({ field }) => {
                            const v = Number(field.value ?? 5);
                            return (
                                <FieldRow
                                    label="余韻"
                                    valueText={`${v}: ${finishLenLabel(v)}`}
                                >
                                    <input
                                        type="range"
                                        min={0}
                                        max={10}
                                        step={0.5}
                                        value={v}
                                        onChange={(e) => field.onChange(Number(e.target.value))}
                                        className="w-full accent-gray-700"
                                    />
                                    <div className="flex justify-between text-xs text-gray-400 px-1 mt-1">
                                        <span>短</span><span>長</span>
                                    </div>
                                </FieldRow>
                            );
                        }}
                    />
                </div>

                <div className="mt-8">
                    <FieldRow label="味わいの補足" hint="例: 温度が上がると甘味の印象が増す、時間経過でタンニンが丸くなる 等">
                        <textarea
                            id="palateNotes"
                            className="w-full input h-24"
                            {...register('palateNotes')}
                        />
                    </FieldRow>
                </div>
            </SectionCard>



            {/* 総合評価 */}
            {/* 総合評価 */}
            <SectionCard
                title="総合評価"
                description="品質、熟成の可能性、全体の感想"
                icon={<Award size={18} />}
                tone="focus"
            >

                <div className="space-y-8">
                    <Controller
                        control={control}
                        name="qualityScore"
                        render={({ field }) => {
                            const v = Number(field.value ?? 5);
                            return (
                                <FieldRow
                                    label="品質評価 (Quality)"
                                    valueText={`${v}: ${qualityLabel(v)}`}
                                >
                                    <input
                                        type="range"
                                        min={0}
                                        max={10}
                                        step={0.5}
                                        value={v}
                                        onChange={(e) => field.onChange(Number(e.target.value))}
                                        className="w-full accent-gray-700"
                                    />
                                    <div className="flex justify-between text-xs text-gray-400 px-1 mt-1">
                                        <span>低</span><span>高</span>
                                    </div>
                                </FieldRow>
                            );
                        }}
                    />

                    <div className="grid sm:grid-cols-2 gap-6">
                        <FieldRow label="熟成の可能性 (Readiness)">
                            <select className="w-full input" {...register('readiness')}>
                                {SAT_CONSTANTS.CONCLUSION.READINESS.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                        </FieldRow>
                    </div>

                    <FieldRow label="寸評 (Notes)">
                        <textarea className="w-full input h-28" {...register('notes')} placeholder="自由記述" />
                    </FieldRow>

                    <div className="pt-6 border-t border-gray-100">
                        <FieldRow label="個人的な好み (Rating)">
                            <Controller
                                control={control}
                                name="rating"
                                render={({ field }) => (
                                    <>
                                        <div className="relative inline-block select-none" aria-label={`Rating ${round1(field.value)} of 5`}>
                                            <div className="text-2xl tracking-tight text-neutral-300">★★★★★</div>
                                            <div
                                                className="absolute top-0 left-0 overflow-hidden text-2xl tracking-tight text-yellow-500 pointer-events-none"
                                                style={{ width: `${(Math.max(0, Math.min(5, Number(field.value))) / 5) * 100}%` }}
                                            >
                                                ★★★★★
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1">
                                            <input
                                                type="range"
                                                min={0}
                                                max={5}
                                                step={0.1}
                                                value={field.value}
                                                onChange={(e) => field.onChange(Number(e.target.value))}
                                                className="w-full"
                                            />
                                            <span className="w-12 text-right text-lg font-medium text-yellow-600">{round1(field.value).toFixed(1)}</span>
                                        </div>
                                    </>
                                )}
                            />
                        </FieldRow>
                    </div>
                </div>
            </SectionCard>

            <section className="sticky bottom-18 z-20 rounded-2xl bg-white/90 backdrop-blur-sm p-4 shadow-lg border border-gray-200 mt-8 space-y-2">
                {Object.keys(errors).length > 0 && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 mb-2">
                        <p className="font-bold">入力内容に不備があります。</p>
                        <ul className="list-disc pl-5 mt-1">
                            {Object.entries(errors).map(([key, error]) => (
                                <li key={key}>
                                    {key}: {error?.message as string}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                    <div className="w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={handleSaveDraft}
                            disabled={isSubmitting}
                            className="w-full sm:w-auto px-6 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl shadow-sm hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300"
                        >
                            {isSubmitting ? '保存中...' : '一時保存'}
                        </button>
                    </div>
                    <div className="w-full sm:w-2/3">
                        <button
                            type="submit"
                            onClick={handlePublish}
                            disabled={isSubmitting}
                            className="w-full px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 border border-blue-500/20"
                        >
                            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : submitLabel}
                        </button>
                    </div>
                </div>
            </section>

            {/* AI Search Section (Deep Dive) - Moved to bottom */}
            <section id="ai-deep-dive" className="rounded-2xl bg-gray-50 p-4 border border-gray-100">
                <button
                    type="button"
                    onClick={() => setIsAiExpanded(!isAiExpanded)}
                    className="w-full flex items-center justify-between group"
                >
                    <div className="flex items-center gap-2">
                        <div className="bg-purple-100 p-2 rounded-full">
                            <Sparkles className="w-5 h-5 text-purple-600" />
                        </div>
                        <div className="text-left">
                            <h2 className="font-bold text-gray-900">AI Deep Dive</h2>
                            <p className="text-xs text-gray-500">Web上の専門情報を検索・参照</p>
                        </div>
                    </div>
                    {isAiExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
                    )}
                </button>

                {isAiExpanded && (
                    <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={handleAiSearch}
                                disabled={isAiLoading}
                                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold rounded-lg hover:shadow-md disabled:opacity-50 flex items-center gap-2"
                            >
                                {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                {isAiLoading ? '検索中...' : '情報を取得する'}
                            </button>
                        </div>

                        <p className="text-sm text-gray-600 bg-white p-3 rounded-lg border border-gray-100">
                            ワイン名・生産者・ヴィンテージを元に、Web上の専門情報を検索します。
                            <br />
                            <span className="text-xs text-gray-400 block mt-1">※ 既に情報が入力されている場合は上書きされます。</span>
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700 flex items-center gap-2">
                                    <BookOpen className="w-4 h-4 text-emerald-600" /> テロワール
                                </label>
                                <textarea className="w-full input h-24 text-sm bg-purple-50/30" {...register('terroir_info')} placeholder="AI検索結果がここに表示されます" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700 flex items-center gap-2">
                                    <User className="w-4 h-4 text-blue-600" /> 生産者・哲学
                                </label>
                                <textarea className="w-full input h-24 text-sm bg-purple-50/30" {...register('producer_philosophy')} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700 flex items-center gap-2">
                                    <Settings className="w-4 h-4 text-gray-600" /> 技術詳細
                                </label>
                                <textarea className="w-full input h-24 text-sm bg-purple-50/30" {...register('technical_details')} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700 flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-orange-600" /> ヴィンテージ分析
                                </label>
                                <textarea className="w-full input h-24 text-sm bg-purple-50/30" {...register('vintage_analysis')} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-red-600" /> 参考テイスティングノート
                                </label>
                                <textarea className="w-full input h-24 text-sm bg-purple-50/30" {...register('search_result_tasting_note')} />
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-200 mt-4 text-center">
                            <p className="text-xs text-gray-500">
                                ※本情報は参考情報です。実際の評価はご自身の感覚を優先してください。
                            </p>
                        </div>
                    </div>
                )}
            </section>

            {/* Floating Navigation Icon */}
            <div className="fixed bottom-40 right-4 z-50 flex flex-col items-end gap-2 text-right pointer-events-none">
                {/* Tooltip Wrapper */}
                <div className={`transition-all duration-300 transform ${showTooltip ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} pointer-events-auto`}>
                    <div className="bg-gray-800 text-white text-xs px-3 py-2 rounded-lg shadow-lg mb-1 max-w-[150px]">
                        ワイン名を記入するとAI検索ができます
                    </div>
                </div>

                <button
                    type="button"
                    onMouseEnter={() => !hasWineName && setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                    onClick={() => {
                        if (!hasWineName) {
                            setShowTooltip(true);
                            setTimeout(() => setShowTooltip(false), 3000);
                            return;
                        }
                        const el = document.getElementById('ai-deep-dive');
                        if (el) {
                            el.scrollIntoView({ behavior: 'smooth' });
                            setIsAiExpanded(true);
                        }
                    }}
                    className={`pointer-events-auto shadow-lg border border-gray-200 p-3 rounded-full transition-all active:scale-95 flex items-center justify-center ${hasWineName
                        ? 'bg-white text-gray-600 hover:bg-gray-50'
                        : 'bg-gray-100 text-gray-400'
                        }`}
                    aria-label="Goto AI Deep Dive"
                >
                    <Bot size={24} />
                </button>
            </div>

            <style jsx global>{`
            .input { @apply rounded-xl border border-neutral-300 bg-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-800; }
            .btn-primary { @apply rounded-xl bg-neutral-900 px-4 py-2 text-white shadow-sm hover:opacity-90 disabled:opacity-50; }
        `}</style>
        </form >
    );
}

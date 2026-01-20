'use client';

import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { searchWineDetails } from '@/app/actions/gemini';
import { Sparkles, Loader2 } from 'lucide-react';
import { useState } from 'react';
import {
    round1,
    fruitStateLabel,
    oakAromaLabel,
    acidityLabel,
    tanninLabel,
    balanceLabel,
    finishLenLabel,
} from '@/lib/wineHelpers';

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

const noseIntensity = ['1. 閉じている', '2. 控えめ', '3. 開いている', '4. やや強い', '5. 強い'] as const;
const palateSweetness = ['辛口', 'やや辛口', '中口', 'やや甘口', '甘口'] as const;
const evaluation = ['シンプル/フレッシュ', '良質', '複雑さ/余韻あり', '秀逸'] as const;

// SAT準拠の選択肢
const satNoseIntensity = ['light', 'med-', 'med', 'med+', 'pronounced'] as const;
const satAcidity = ['low', 'med-', 'med', 'med+', 'high'] as const;
const satTannin = ['low', 'med-', 'med', 'med+', 'high'] as const;
const satFinish = ['short', 'med-', 'med', 'med+', 'long'] as const;
const satQuality = ['poor', 'acceptable', 'good', 'very good', 'outstanding'] as const;

// 代表的アロマ
const aromaGroups = [
    { name: '果実（赤）', options: ['イチゴ', 'ラズベリー', 'ブルーベリー', 'カシス', 'ブラックベリー', 'ブラックチェリー', '干しプラム'] },
    { name: '果実（白）', options: ['レモン', 'グレープフルーツ', '青リンゴ', 'リンゴ', '洋ナシ', 'アプリコット', '白桃', 'トロピカル', 'パッションフルーツ'] },
    { name: '植物/ハーブ（赤）', options: ['バラ', 'スミレ', '牡丹', 'ドライハーブ', 'ピーマン', 'ユーカリ', 'ミント', '杉', '針葉樹', 'タバコ', '紅茶', 'キノコ'] },
    { name: '植物/ハーブ（白）', options: ['スイカズラ', 'アカシア', '白バラ', 'キンモクセイ', '菩提樹', 'ミント', 'アニス', 'ヴェルヴェーヌ', 'ハーブ', 'タイム', 'ヘーゼルナッツ'] },
    { name: '樽/熟成', options: ['ヴァニラ', 'トースト', 'スモーク', 'シナモン', 'ナツメグ', 'コーヒー', 'チョコレート', 'レザー', '黒胡椒', '丁子', '甘草', '生肉', 'ブレット'] },
    { name: '土/鉱物', options: ['土', '鉛筆の芯', '湿った土', '石灰', '火打石', 'スーボア', 'トリュフ', '樹脂'] }
] as const;

export const wineFormSchema = z.object({
    //テイスティング情報
    date: z.string(),
    price: z.string().optional().nullable(),          // 価格（任意）
    place: z.string().optional().nullable(),          // 飲んだ/購入した場所
    imageUrl: z.string().optional().nullable(),       // ひとまずURL（アップロードは次段）

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

    //外観
    wineType: z.enum(wineTypes),       // ← タブで選ぶ
    intensity: z.coerce.number().min(1).max(5).optional().nullable(),  // 濃淡 1-5
    rimRatio: z.coerce.number().min(0).max(10).optional().nullable(),  // 縁色調の割合（0:紫多い〜10:オレンジ多い）
    clarity: z.string().optional().nullable(),
    brightness: z.string().optional().nullable(),
    sparkleIntensity: z.string().optional().nullable(),
    appearanceOther: z.string().optional().nullable(),

    //香り
    noseIntensity: z.string().optional().nullable(),
    oldNewWorld: z.coerce.number().min(1).max(5).optional().nullable(),  // 赤/ロゼ/オレンジで表示
    fruitsMaturity: z.coerce.number().min(1).max(5).optional().nullable(),  // 赤/ロゼ/オレンジで表示
    aromaNeutrality: z.coerce.number().min(1).max(5).optional().nullable(),  // 白で表示
    aromas: z.array(z.string()).optional().nullable(),
    oakAroma: z.coerce.number().min(1).max(5).optional().nullable(),
    aromaOther: z.string().optional().nullable(),

    //味わい
    sweetness: z.string().optional().nullable(),
    acidityScore: z.coerce.number().min(1).max(5).optional().nullable(),     // 酸味 1-5, 0.1刻み
    tanninScore: z.coerce.number().min(1).max(5).optional().nullable(),      // タンニン 〃（赤/オレンジで表示）
    balanceScore: z.coerce.number().min(1).max(5).optional().nullable(),     // 味わいのバランス 〃
    alcoholABV: z.coerce.number().min(0).max(100).optional().nullable(), // アルコール度数（数字入力）
    finishLen: z.coerce.number().min(0).max(10).optional().nullable(),       // 余韻 0-10, 1刻み
    palateNotes: z.string().optional().nullable(),         // 味わいの補足

    //総合評価
    evaluation: z.string().optional().nullable(),
    rating: z.number().min(0).max(5),
    notes: z.string().optional().nullable(),

    vivinoUrl: z.string().optional().nullable(),

    // AI Fields
    terroir_info: z.string().optional().nullable(),
    producer_philosophy: z.string().optional().nullable(),
    technical_details: z.string().optional().nullable(),
    vintage_analysis: z.string().optional().nullable(),
    search_result_tasting_note: z.string().optional().nullable(),

    // SAT準拠項目
    sat_nose_intensity: z.union([z.enum(satNoseIntensity), z.literal('')]).optional().nullable(),
    sat_acidity: z.union([z.enum(satAcidity), z.literal('')]).optional().nullable(),
    sat_tannin: z.union([z.enum(satTannin), z.literal('')]).optional().nullable(),
    sat_finish: z.union([z.enum(satFinish), z.literal('')]).optional().nullable(),
    sat_quality: z.union([z.enum(satQuality), z.literal('')]).optional().nullable(),
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

            intensity: 3.0,
            rimRatio: 5.0,
            clarity: '澄んだ',
            brightness: '輝きのある',
            sparkleIntensity: '',
            appearanceOther: '',

            noseIntensity: '3. 開いている',
            oldNewWorld: 3.0,
            aromaNeutrality: 3.0,
            fruitsMaturity: 1.0,
            oakAroma: 1,
            aromas: [],
            aromaOther: '',

            sweetness: '辛口',
            acidityScore: 2.5,
            tanninScore: 2.5,
            balanceScore: 3.0,
            alcoholABV: 12.5,
            finishLen: 5,
            palateNotes: '',

            evaluation: '良質',
            rating: 3.5,
            notes: '',
            vivinoUrl: '',

            sat_nose_intensity: undefined,
            sat_acidity: undefined,
            sat_tannin: undefined,
            sat_finish: undefined,
            sat_quality: undefined,


            terroir_info: '',
            producer_philosophy: '',
            technical_details: '',
            vintage_analysis: '',
            search_result_tasting_note: '',
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
            intensity: 3.0,
            rimRatio: 5.0,
            clarity: '澄んだ',
            brightness: '輝きのある',
            sparkleIntensity: '',
            appearanceOther: '',
            noseIntensity: '3. 開いている',
            oldNewWorld: 3.0,
            aromaNeutrality: 3.0,
            fruitsMaturity: 1.0,
            oakAroma: 1,
            aromas: [],
            aromaOther: '',
            sweetness: '辛口',
            acidityScore: 2.5,
            tanninScore: 2.5,
            balanceScore: 3.0,
            alcoholABV: 12.5,
            finishLen: 5,
            palateNotes: '',
            evaluation: '良質',
            rating: 3.5,
            notes: '',
            vivinoUrl: '',
            sat_nose_intensity: undefined,
            sat_acidity: undefined,
            sat_tannin: undefined,
            sat_finish: undefined,
            sat_quality: undefined,
            terroir_info: '',
            producer_philosophy: '',
            technical_details: '',
            vintage_analysis: '',
            search_result_tasting_note: '',
        };

        // @ts-ignore - reset expects partial or values depending on version, strict type match might fail on undefineds but we can cast or just use what we have.
        // Actually hook form reset can take values.

        // We need to bring in the `reset` function from `useForm`.
        reset(freshDefaults);

        // Also clear any "search result" state
        setIsAiExpanded(false);
    };

    const wineType = watch('wineType');

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

    const filteredAromaGroups = (() => {
        if (isRed) {
            return aromaGroups.filter(g => g.name !== ('果実（白）')).filter(g => g.name !== ('植物/ハーブ（白）'));
        }
        if (isWhite) {
            return aromaGroups.filter(g => g.name !== '果実（赤）').filter(g => g.name !== ('植物/ハーブ（赤）'));
        }
        return aromaGroups;
    })();

    const onFileSelect = async (file: File) => {
        try {
            const r = await fetch('/api/upload-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: file.name, contentType: file.type }),
            });
            const { putUrl, getUrl, error } = await r.json();
            console.log(putUrl, getUrl, error); // debug
            if (error) throw new Error(error);

            const res = await fetch(putUrl, {
                method: 'PUT',
                headers: { 'Content-Type': file.type },
                body: file,
            });
            if (!res.ok) throw new Error('Upload failed');

            setValue('imageUrl', getUrl, { shouldDirty: true });
        } catch (err) {
            alert(String(err));
        }
    };

    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isAiExpanded, setIsAiExpanded] = useState(!!defaultValues?.terroir_info);

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
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
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
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl bg-white p-4 shadow-sm">
                <h2 className="font-medium">基本情報</h2>
                <div>
                    <label className="block text-sm mb-1">日付</label>
                    <input type="date" className="w-full input" {...register('date')} />
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                        <label className="block text-sm mb-1">飲んだ/購入した場所</label>
                        <input className="w-full input" placeholder="例: 自宅 / ○○レストラン / △△ワインショップ"
                            {...register('place')} />
                    </div>
                </div>
                <input
                    type="file"
                    accept="image/*"
                    className="sm:col-span-3 rounded-full border"
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onFileSelect(f).catch(err => alert(String(err)));
                    }}
                />
                {watch('imageUrl') && (
                    <div className="sm:col-span-3 mt-2">
                        <p className="text-xs text-gray-500 mb-1">現在の画像:</p>
                        <img src={watch('imageUrl')!} alt="preview" className="h-32 object-contain rounded-md border" />
                    </div>
                )}
            </section>


            <section className="gap-4 rounded-2xl bg-white p-4 shadow-sm space-y-3">
                <h2 className="font-medium">ワイン情報</h2>
                <div className='grid grid-cols-1 sm:grid-cols-2'>
                    <div>
                        <label className="block text-sm mb-1">ワイン名*（例: Domaine X, cuvée）</label>
                        <input className="w-full input" placeholder="Wine name" {...register('wineName')} />
                        {errors.wineName && <p className="text-red-600 text-sm">必須です</p>}
                    </div>
                    <div>
                        <label className="block text-sm mb-1">生産者</label>
                        <input className="w-full input" {...register('producer')} />
                    </div>
                    <div>
                        <label className="block text-sm mb-1">ヴィンテージ</label>
                        <input className="w-full input" placeholder="例: 2021" {...register('vintage')} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
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
                                    <div>
                                        <label className="block text-sm mb-1">ボトル価格</label>
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
                                    </div>
                                );
                            }}

                        />
                    </div>
                    <div>
                        <label className="block text-sm mb-1">色</label>
                        <input
                            type="text"
                            value={watch('wineType') ?? ''}
                            readOnly
                            className="w-full input bg-gray-50 text-gray-700 cursor-default"
                        />
                    </div>
                </div>
                <h3 className="font-medium">生産地</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm mb-1">国</label>
                        <select className="w-full input" {...register('country')}>
                            <option value="">未選択</option>
                            {countries.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm mb-1">地名（地域/村/畑など）</label>
                        <input className="w-full input" placeholder="例: ブルゴーニュ／ニュイ＝サン＝ジョルジュ／レ・ダモード"
                            {...register('locality')} />
                    </div>
                </div>
                <h3 className="font-medium">品種</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm mb-1">主体の品種</label>
                        <select className="w-full input" {...register('mainVariety')}>
                            <option value="">未選択</option>
                            {mainVarieties.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm mb-1">その他（補助品種・ブレンド等）</label>
                        <input className="w-full input" placeholder="例: プティ・ヴェルド 5% など"
                            {...register('otherVarieties')} />
                    </div>
                </div>

                <div className="sm:col-span-3">
                    <label className="block text-sm mb-1">補足情報（自由入力）</label>
                    <textarea
                        className="w-full input h-28"
                        placeholder="例: 畑情報、区画、樹齢、醸造メモ、輸入元メモ、保存環境 など自由に"
                        {...register('additionalInfo')}
                    />
                </div>
            </section>

            {/* AI Search Section */}
            <section className="rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50 p-4 shadow-sm border border-purple-100">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="font-bold text-gray-900 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-600" />
                        AI Deep Dive (情報検索)
                    </h2>
                    <button
                        type="button"
                        onClick={handleAiSearch}
                        disabled={isAiLoading}
                        className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {isAiLoading ? '検索中...' : '情報を取得'}
                    </button>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                    ワイン名・生産者・ヴィンテージを元に、Web上の専門情報を検索・自動入力します。
                </p>

                {isAiExpanded && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-700">テロワール</label>
                            <textarea className="w-full input h-24 text-sm" {...register('terroir_info')} placeholder="AI検索結果がここに表示されます" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-700">生産者・哲学</label>
                            <textarea className="w-full input h-24 text-sm" {...register('producer_philosophy')} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-700">技術詳細</label>
                            <textarea className="w-full input h-24 text-sm" {...register('technical_details')} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-700">ヴィンテージ分析</label>
                            <textarea className="w-full input h-24 text-sm" {...register('vintage_analysis')} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-700">参考テイスティングノート</label>
                            <textarea className="w-full input h-24 text-sm" {...register('search_result_tasting_note')} />
                        </div>
                    </div>
                )}
            </section>

            {/* 外観 */}
            <section className="rounded-2xl p-4 shadow-sm bg-[var(--surface)] text-[var(--fg)] border border-[var(--border)]">
                <h2 className="font-medium">外観</h2>
                <div className="grid sm:grid-cols-3 gap-3">
                    <div>
                        <label className="block text-sm mb-1">清澄度</label>
                        <select
                            className="w-full rounded-md px-3 py-2 bg-[var(--surface)] text-[var(--fg)] border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                            {...register('clarity')}
                        >
                            {apperance.clarity.map(v => (
                                <option key={v.label} value={v.label}>{v.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm mb-1">輝き</label>
                        <select className="w-full input" {...register('brightness')}>
                            {apperance.brightness.map(v => (
                                <option key={v.label} value={v.label}>{v.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm mb-1">色調/濃淡（1=淡い, 5=濃い）</label>
                    {isRed && (
                        <p className="text-sm text-[var(--fg-muted)]">
                            {(() => {
                                const v = round1(Number(watch('intensity') ?? 3));
                                const label = v > 4 ? 'ガーネット' : 'ルビー';
                                return `${v.toFixed(1)}: ${label}`;
                            })()}
                        </p>
                    )}
                    {(isWhite || isSparklingWhite) && (
                        <p className="text-sm mb-1">
                            {(() => {
                                const v = round1(Number(watch('intensity')));
                                const label = v > 3 ? 'イエロー' : 'レモンイエロー';
                                return `${v.toFixed(1)}: ${label}`;
                            })()}
                        </p>
                    )}
                    {(isRose || isSparklingRose) && (
                        <p className="text-sm mb-1">
                            {(() => {
                                const v = round1(Number(watch('intensity')));
                                const label = v <= 3 ? '淡いピンク' : '濃いピンク';
                                return `${v.toFixed(1)}: ${label}`;
                            })()}
                        </p>
                    )}
                    {isOrange && (
                        <p className="text-sm mb-1">
                            {(() => {
                                const v = round1(Number(watch('intensity')));
                                const label = v <= 3 ? '淡いオレンジ' : '濃いオレンジ';
                                return `${v.toFixed(1)}: ${label}`;
                            })()}
                        </p>
                    )}
                    <Controller
                        control={control}
                        name="intensity"
                        render={({ field }) => (
                            <>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="range"
                                        min={1}
                                        max={5}
                                        step={0.1}
                                        list="intensityTicks"
                                        value={field.value ?? 3}
                                        onChange={(e) => field.onChange(Number(e.target.value))}
                                        className="w-full accent-gray-700"
                                    />
                                </div>
                                <datalist id="intensityTicks">
                                    <option value="2" label="2" />
                                    <option value="3" label="3" />
                                    <option value="4" label="4" />
                                </datalist>
                            </>
                        )}
                    />
                </div>

                <div>
                    <label className="block text-sm mb-1">縁の色調</label>
                    <Controller
                        control={control}
                        name="rimRatio"
                        render={({ field }) => {
                            const v = round1(10 - Number(field.value ?? 5));
                            const comp = round1(Number(field.value ?? 5));

                            let labelLeft = '';
                            let labelRight = '';
                            let desc = '';

                            if (isRed) {
                                labelLeft = '紫';
                                labelRight = 'オレンジ';
                                desc = '10:0（紫がかった）〜 0:10（オレンジがかった）';
                            } else if (isWhite || isSparklingWhite) {
                                labelLeft = 'グリーン';
                                labelRight = 'ゴールド';
                                desc = '10:0（グリーンがかった）〜 0:10（黄金色がかった）';
                            } else if (isRose || isSparklingRose) {
                                labelLeft = 'ピンク';
                                labelRight = 'オレンジ';
                                desc = '10:0（ピンクがかった）〜 0:10（オレンジがかった）';
                            } else if (isOrange) {
                                labelLeft = '黄金';
                                labelRight = 'ブロンズ';
                                desc = '10:0（黄金色がかった）〜 0:10（銅色がかった）';
                            }

                            return (
                                <>
                                    <p className='text-sm'>{desc}</p>
                                    <p className="text-sm">
                                        {labelLeft} {v.toFixed(1)} : {labelRight} {comp.toFixed(1)}
                                    </p>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="range"
                                            min={0}
                                            max={10}
                                            step={0.1}
                                            list="rimRatioTicks"
                                            value={field.value ?? 5}
                                            onChange={(e) => field.onChange(Number(e.target.value))}
                                            className="w-full accent-gray-700"
                                        />
                                    </div>
                                    <datalist id="rimRatioTicks">
                                        <option value="1" label="1" />
                                        <option value="2" label="2" />
                                        <option value="3" label="3" />
                                        <option value="4" label="4" />
                                        <option value="5" label="5" />
                                        <option value="6" label="6" />
                                        <option value="7" label="7" />
                                        <option value="8" label="8" />
                                        <option value="9" label="9" />
                                    </datalist>
                                </>
                            );
                        }}
                    />
                </div>

                {(isSparklingWhite || isSparklingRose) && (
                    <div>
                        <label className="block text-sm mb-1">泡の強さ</label>
                        <select
                            className="w-full rounded-md px-3 py-2 bg-[var(--surface)] text-[var(--fg)] border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                            {...register('sparkleIntensity')}
                        >
                            {['弱い', 'やや弱い', '中程度', 'やや強い', '強い'].map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                )}

                <div>
                    <label className="block text-sm mb-1">その他の外観の特徴</label>
                    <textarea
                        className="w-full h-28 rounded-md px-3 py-2 bg-[var(--surface)] text-[var(--fg)] border border-[var(--border)] placeholder-[var(--fg-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        placeholder="例: 泡のきめ細かさ、涙、濁り、ガス感、粘性 など"
                        {...register('appearanceOther')}
                    />
                </div>
            </section>

            {/* 香り */}
            <section className="rounded-2xl bg-white p-4 shadow-sm space-y-3">
                <h2 className="font-medium">香り</h2>
                <div>
                    <label className="block text-sm mb-1">強さ</label>
                    <select className="w-full input" {...register('noseIntensity')}>
                        {noseIntensity.map(v => (<option key={v} value={v}>{v}</option>))}
                    </select>
                </div>

                {/* SAT準拠: 香りの強さ */}
                <div>
                    <label className="block text-sm mb-1">香りの強さ (SAT)</label>
                    <select className="w-full input" {...register('sat_nose_intensity')}>
                        <option value="">未選択</option>
                        {satNoseIntensity.map(v => (<option key={v} value={v}>{v}</option>))}
                    </select>
                </div>

                {(isRed || isRose || isOrange) && (
                    <div>
                        <label className="block text-sm mb-1">
                            旧/新世界（1=旧世界, 5=新世界）
                        </label>

                        <p className="text-sm mb-1">
                            {(() => {
                                const raw = watch('oldNewWorld') ?? 3;
                                const v = round1(Number(raw));
                                const label = v <= 3 ? '旧世界' : '新世界';
                                return `${v.toFixed(1)}: ${label}`;
                            })()}
                        </p>

                        <Controller
                            control={control}
                            name="oldNewWorld"
                            render={({ field }) => (
                                <div className="flex items-center gap-3">
                                    <input
                                        type="range"
                                        min={1}
                                        max={5}
                                        step={0.1}
                                        list="oldNewWorldTicks"
                                        value={field.value ?? 3}
                                        onChange={(e) => field.onChange(Number(e.target.value))}
                                        className="w-full accent-gray-700"
                                    />
                                </div>
                            )}
                        />

                        <datalist id="oldNewWorldTicks">
                            <option value="2" label="2" />
                            <option value="3" label="3" />
                            <option value="4" label="4" />
                        </datalist>
                    </div>
                )}

                {isWhite && (
                    <div>
                        <label className="block text-sm mb-1">
                            ニュートラル / アロマティック（1=ニュートラル, 5=アロマティック）
                        </label>

                        <p className="text-sm mb-1">
                            {(() => {
                                const raw = watch('aromaNeutrality');
                                const v = round1(typeof raw === 'number' ? raw : Number(raw ?? 3));
                                const label = v <= 3 ? 'ニュートラル' : 'アロマティック';
                                return `${v.toFixed(1)}: ${label}`;
                            })()}
                        </p>

                        <Controller
                            control={control}
                            name="aromaNeutrality"
                            render={({ field }) => {
                                const v =
                                    typeof field.value === 'number'
                                        ? field.value
                                        : Number(field.value ?? 3);

                                return (
                                    <>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="range"
                                                min={1}
                                                max={5}
                                                step={0.1}
                                                list="aromaNeutralityTicks"
                                                value={v}
                                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                                onBlur={field.onBlur}
                                                name={field.name}
                                                ref={field.ref}
                                                className="w-full accent-gray-700"
                                            />
                                        </div>
                                        <datalist id="aromaNeutralityTicks">
                                            <option value="2" label="2" />
                                            <option value="3" label="3" />
                                            <option value="4" label="4" />
                                        </datalist>
                                    </>
                                );
                            }}
                        />
                    </div>
                )}

                {(isRed || isRose || isOrange) && (
                    <div className="mb-3">
                        <label htmlFor="fruitsMaturity" className="block text-sm mb-1">
                            果実の状態
                        </label>
                        <Controller
                            control={control}
                            name="fruitsMaturity"
                            render={({ field }) => {
                                const v = round1(Number(field.value));
                                return (
                                    <>
                                        <p className="text-sm mb-1">
                                            {v.toFixed(1)}: {fruitStateLabel(v)}
                                        </p>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="range"
                                                min={1}
                                                max={5}
                                                step={0.1}
                                                list="fruitsMaturityTicks"
                                                value={field.value ?? 3}
                                                onChange={(e) => field.onChange(Number(e.target.value))}
                                                className="w-full accent-gray-700"
                                            />
                                        </div>
                                        <datalist id="fruitsMaturityTicks">
                                            <option value="2" label="2" />
                                            <option value="3" label="3" />
                                            <option value="4" label="4" />
                                        </datalist>
                                    </>
                                );
                            }}
                        />
                    </div>
                )}

                <div className="mt-3">
                    <label htmlFor="oakAroma" className="block text-sm mb-1">樽香</label>

                    <Controller
                        control={control}
                        name="oakAroma"
                        render={({ field }) => {
                            const v = Math.round((field.value ?? 1) * 10) / 10;
                            return (
                                <div className="flex flex-col gap-1">
                                    <p className="text-sm mb-1">
                                        {v.toFixed(1)}: {oakAromaLabel(v)}
                                    </p>

                                    <div className="flex items-center gap-3">
                                        <input
                                            type="range"
                                            id="oakAroma"
                                            min={1}
                                            max={5}
                                            step={0.5}
                                            list="oakAromaTicks"
                                            value={v}
                                            onChange={(e) => field.onChange(Number(e.target.value))}
                                            className="w-full accent-gray-700"
                                        />
                                    </div>

                                    <datalist id="oakAromaTicks">
                                        <option value="1" label="1" />
                                        <option value="2" label="2" />
                                        <option value="3" label="3" />
                                        <option value="4" label="4" />
                                        <option value="5" label="5" />
                                    </datalist>

                                    <div className="flex justify-between text-xs text-gray-500 px-1">
                                        <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
                                    </div>
                                </div>
                            );
                        }}
                    />
                </div>

                <div className="space-y-2">
                    <p className="text-sm">印象（複数選択可）</p>
                    <Controller
                        control={control}
                        name="aromas"
                        render={({ field }) => (
                            <div className="space-y-2">
                                {filteredAromaGroups.map(group => (
                                    <div key={group.name}>
                                        <p className="text-sm font-medium mb-1">{group.name}</p>
                                        <div className="flex flex-wrap gap-2">
                                            {group.options.map(opt => {
                                                const checked = field.value?.includes(opt) ?? false;
                                                return (
                                                    <button
                                                        type="button"
                                                        key={opt}
                                                        className={`px-3 py-1 rounded-full border ${checked ? 'bg-black text-white' : 'bg-white'}`}
                                                        onClick={() => {
                                                            const cur = new Set(field.value || []);
                                                            checked ? cur.delete(opt) : cur.add(opt);
                                                            field.onChange(Array.from(cur));
                                                        }}
                                                    >
                                                        {opt}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
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

            </section>

            {/* 味わい */}
            <section className="rounded-2xl bg-white p-4 shadow-sm space-y-3">
                <h2 className="font-medium">味わい</h2>
                <div className="grid sm:grid-cols-3 gap-3">
                    <div>
                        <label className="block text-sm mb-1">甘味</label>
                        <select className="w-full input" {...register('sweetness')}>
                            {palateSweetness.map(v => (<option key={v} value={v}>{v}</option>))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="acidityScore" className="block text-sm mb-1">酸味</label>
                        <Controller
                            control={control}
                            name="acidityScore"
                            render={({ field }) => {
                                const v = round1(Number(field.value ?? 2.5));
                                return (
                                    <div className="flex flex-col gap-1">
                                        <p className="text-sm">{v.toFixed(1)}: {acidityLabel(v)}</p>
                                        <input
                                            id="acidityScore"
                                            type="range"
                                            min={1}
                                            max={5}
                                            step={0.1}
                                            list="ticks_1to5"
                                            value={v}
                                            onChange={(e) => field.onChange(Number(e.target.value))}
                                            className="w-full accent-gray-700"
                                        />
                                    </div>
                                );
                            }}
                        />
                    </div>

                    {/* SAT準拠: 酸味 */}
                    <div>
                        <label className="block text-sm mb-1">酸味 (SAT)</label>
                        <select className="w-full input" {...register('sat_acidity')}>
                            <option value="">未選択</option>
                            {satAcidity.map(v => (<option key={v} value={v}>{v}</option>))}
                        </select>
                    </div>

                    {(isRed || isOrange) && (
                        <>
                            <div>
                                <label htmlFor="tanninScore" className="block text-sm mb-1">タンニン分</label>
                                <Controller
                                    control={control}
                                    name="tanninScore"
                                    render={({ field }) => {
                                        const v = round1(Number(field.value ?? 2.5));
                                        return (
                                            <div className="flex flex-col gap-1">
                                                <p className="text-sm">{v.toFixed(1)}: {tanninLabel(v)}</p>
                                                <input
                                                    id="tanninScore"
                                                    type="range"
                                                    min={1}
                                                    max={5}
                                                    step={0.1}
                                                    list="ticks_1to5"
                                                    value={v}
                                                    onChange={(e) => field.onChange(Number(e.target.value))}
                                                    className="w-full accent-gray-700"
                                                />
                                            </div>
                                        );
                                    }}
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1">タンニン (SAT)</label>
                                <select className="w-full input" {...register('sat_tannin')}>
                                    <option value="">未選択</option>
                                    {satTannin.map(v => (<option key={v} value={v}>{v}</option>))}
                                </select>
                            </div>
                        </>
                    )}

                    <div>
                        <label htmlFor="balanceScore" className="block text-sm mb-1">味わいのバランス</label>
                        <Controller
                            control={control}
                            name="balanceScore"
                            render={({ field }) => {
                                const v = round1(Number(field.value ?? 3.0));
                                return (
                                    <div className="flex flex-col gap-1">
                                        <p className="text-sm">{v.toFixed(1)}: {balanceLabel(v)}</p>
                                        <input
                                            id="balanceScore"
                                            type="range"
                                            min={1}
                                            max={5}
                                            step={0.1}
                                            list="ticks_1to5"
                                            value={v}
                                            onChange={(e) => field.onChange(Number(e.target.value))}
                                            className="w-full accent-gray-700"
                                        />
                                    </div>
                                );
                            }}
                        />
                    </div>

                    <div>
                        <label htmlFor="alcoholABV" className="block text-sm mb-1">アルコール度数（%）</label>
                        <input
                            id="alcoholABV"
                            type="number"
                            step="0.1"
                            min={0}
                            max={30}
                            className="w-full input"
                            {...register('alcoholABV', { valueAsNumber: true })}
                            placeholder="例: 12.5"
                        />
                    </div>

                    <div>
                        <label htmlFor="finishLen" className="block text-sm mb-1">余韻</label>
                        <Controller
                            control={control}
                            name="finishLen"
                            render={({ field }) => {
                                const v = Math.round(Number(field.value ?? 5));
                                return (
                                    <div className="flex flex-col gap-1">
                                        <p className="text-sm">{v}: {finishLenLabel(v)}</p>
                                        <input
                                            id="finishLen"
                                            type="range"
                                            min={0}
                                            max={10}
                                            step={1}
                                            list="ticks_0to11"
                                            value={v}
                                            onChange={(e) => field.onChange(Number(e.target.value))}
                                            className="w-full accent-gray-700"
                                        />
                                    </div>
                                );
                            }}
                        />
                    </div>

                    <div>
                        <label className="block text-sm mb-1">余韻 (SAT)</label>
                        <select className="w-full input" {...register('sat_finish')}>
                            <option value="">未選択</option>
                            {satFinish.map(v => (<option key={v} value={v}>{v}</option>))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="palateNotes" className="block text-sm mb-1">味わいの補足</label>
                        <textarea
                            id="palateNotes"
                            className="w-full input h-24"
                            placeholder="例: 温度が上がると甘味の印象が増す、時間経過でタンニンが丸くなる 等"
                            {...register('palateNotes')}
                        />
                    </div>

                    <datalist id="ticks_1to5">
                        <option value="1" label="1" />
                        <option value="2" label="2" />
                        <option value="3" label="3" />
                        <option value="4" label="4" />
                        <option value="5" label="5" />
                    </datalist>
                    <datalist id="ticks_0to11">
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i} value={i} label={String(i)} />
                        ))}
                    </datalist>

                    <label className="block text-sm mb-1">評価</label>
                    <select className="w-full input" {...register('evaluation')}>
                        {evaluation.map(v => (<option key={v} value={v}>{v}</option>))}
                    </select>
                </div>
            </section>

            {/* 補足 */}
            <section className="rounded-2xl bg-white p-4 shadow-sm space-y-3">
                <h2 className="font-medium">補足</h2>
                <div className="grid sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-3">
                        <label className="block text-sm mb-1">Vivino URL</label>
                        <input className="w-full input" placeholder="https://www.vivino.com/..." {...register('vivinoUrl')} />
                    </div>
                    <div className="sm:col-span-3">
                        <label className="block text-sm mb-1">メモ</label>
                        <textarea className="w-full input h-28" {...register('notes')} />
                    </div>
                </div>
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-sm space-y-2">
                <h2 className="font-medium">総合評価</h2>
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
                                <span className="w-12 text-right">{round1(field.value).toFixed(1)}</span>
                            </div>
                        </>
                    )}
                />

                <div>
                    <label className="block text-sm mb-1">品質 (SAT)</label>
                    <select className="w-full input" {...register('sat_quality')}>
                        <option value="">未選択</option>
                        {satQuality.map(v => (<option key={v} value={v}>{v}</option>))}
                    </select>
                </div>
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-sm space-y-2">
                {Object.keys(errors).length > 0 && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
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
                <div className="flex items-center justify-between">
                    <button type="submit" disabled={isSubmitting} className="btn-primary !pointer-events-auto">{isSubmitting ? '送信中…' : submitLabel}</button>
                </div>
            </section>

            <style jsx global>{`
            .input { @apply rounded-xl border border-neutral-300 bg-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-800; }
            .btn-primary { @apply rounded-xl bg-neutral-900 px-4 py-2 text-white shadow-sm hover:opacity-90 disabled:opacity-50; }
        `}</style>
        </form>
    );
}

'use client';

import React, { useCallback, useEffect, useImperativeHandle, forwardRef, useLayoutEffect, useRef } from 'react';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { searchWineDetails, optimizeAndAnalyzeWineImage, interpretTastingTranscript } from '@/app/actions/gemini';
import { Sparkles, Loader2, Eye, Wind, Grape, Award, ChevronDown, ChevronUp, BookOpen, User, Settings, Calendar, FileText, Bot, ImageIcon } from 'lucide-react';
import { useState } from 'react';
import { SectionCard } from '@/components/ui/section-card';
import { LocalityCombobox } from '@/components/wine/form/LocalityCombobox';
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
import { extractExifCaptureDate, generateThumbnail } from '@/lib/imageUtils';
import { Trash2 } from 'lucide-react';
import { SAT_CONSTANTS } from '@/constants/sat';
import AromaSelector from '@/components/AromaSelector';
import { FieldRow } from '@/components/ui/field-row';
import { FORM_CONTROL_BASE } from '@/constants/styles';
import { SimpleRecordingControls } from '@/components/wine/form/SimpleRecordingControls';
import { countries, mainVarieties, wineTypes } from '@/constants/wine';

export { countries, mainVarieties, wineTypes } from '@/constants/wine';

// === 定義：画像シートを意識した選択肢 ===
function removeUndefined<T extends object>(obj: T): Partial<T> {
    const newObj: Partial<T> = {};
    for (const key in obj) {
        if (obj[key] !== undefined) {
            newObj[key] = obj[key];
        }
    }
    return newObj;
}

const nullableNumber = (min: number, max: number) =>
    z.preprocess((value) => {
        if (value === '' || value === null || value === undefined) return null;
        if (typeof value === 'number' && Number.isNaN(value)) return null;
        return Number(value);
    }, z.number().min(min).max(max).nullable().optional());

interface NullableRangeFieldProps {
    label: string;
    value: number | null | undefined;
    min: number;
    max: number;
    step: number;
    emptyValue: number;
    labels: [string, string];
    formatValue: (value: number) => string;
    onChange: (value: number | null) => void;
}

function NullableRangeField({
    label,
    value,
    min,
    max,
    step,
    emptyValue,
    labels,
    formatValue,
    onChange,
}: NullableRangeFieldProps) {
    const hasValue = value !== null && value !== undefined;
    const displayValue = hasValue ? Number(value) : emptyValue;

    return (
        <FieldRow
            label={label}
            valueText={hasValue ? formatValue(displayValue) : '未入力'}
        >
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={displayValue}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full accent-[var(--text)]"
            />
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)] px-1 mt-1">
                <span>{labels[0]}</span>
                <button
                    type="button"
                    onClick={() => onChange(null)}
                    className="rounded px-2 py-1 text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                >
                    クリア
                </button>
                <span>{labels[1]}</span>
            </div>
        </FieldRow>
    );
}

type AutoGrowingTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    value: string;
};

function AutoGrowingTextarea({ className = '', value, onInput, ...props }: AutoGrowingTextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const resize = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.style.height = 'auto';
        textarea.style.height = `${Math.max(textarea.scrollHeight, 192)}px`;
    }, []);

    useLayoutEffect(() => {
        resize();
    }, [resize, value]);

    return (
        <textarea
            {...props}
            ref={textareaRef}
            value={value}
            rows={6}
            className={`${className} min-h-48 resize-none overflow-hidden`}
            onInput={(event) => {
                onInput?.(event);
                resize();
            }}
        />
    );
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

// 代表的アロマ (Legacy - moved to SAT_AROMA_DEFINITIONS in AromaSelector)

export const wineFormSchema = z.object({
    //テイスティング情報
    date: z.string(),
    price: z.string().optional().nullable(),          // 価格（任意）
    place: z.string().optional().nullable(),          // 飲んだ/購入した場所
    imageUrl: z.string().optional().nullable(),       // ひとまずURL（メイン画像 - 互換性のため残す、または先頭の画像を入れる）
    images: z.array(z.object({
        url: z.string(),
        thumbnail_url: z.string().optional().nullable(),
        storage_path: z.string().optional().nullable(),
        display_order: z.number().optional().nullable()
    })).optional().nullable(),

    // ワイン情報
    wineName: z.string().min(1),
    producer: z.string().optional().nullable(),
    country: z.string().optional().nullable(),        // セレクト
    locality: z.string().optional().nullable(),       // 自由記述（地名）
    locality_vocab_id: z.number().optional().nullable(),
    region: z.string().optional().nullable(),
    mainVariety: z.string().optional().nullable(),    // 主体の品種（セレクト）
    otherVarieties: z.string().optional().nullable(), // 自由記述
    referenceUrl: z.string().optional().nullable(),
    additionalInfo: z.string().optional().nullable(),
    vintage: z.string().optional().nullable(),
    importer: z.string().optional().nullable(),

    //外観
    wineType: z.enum(wineTypes),
    color: nullableNumber(0, 10), // SAT Color 0-10
    intensity: nullableNumber(0, 10), // SAT Intensity 0-10
    rimRatio: z.coerce.number().optional().nullable(), // Hidden
    clarity: z.string().optional().nullable(),
    brightness: z.string().optional().nullable(),
    sparkleIntensity: z.string().optional().nullable(),
    appearanceOther: z.string().optional().nullable(),

    //香り
    noseIntensity: nullableNumber(0, 10), // SAT 0-10
    noseCondition: z.enum(['不快 (Unclean)', '良好 (Clean)']).optional().nullable(),
    development: z.enum(['若い', '熟成中', '熟成した', 'ピークを過ぎた/疲れている']).optional().nullable(),

    oldNewWorld: nullableNumber(1, 5), // Keep 1-5 for now or update? Request only listed specific items. Keep as is.
    fruitsMaturity: nullableNumber(1, 5),
    aromaNeutrality: nullableNumber(1, 5),
    aromas: z.array(z.string()).optional().nullable(),
    oakAroma: nullableNumber(1, 5),
    aromaOther: z.string().optional().nullable(),

    //味わい
    sweetness: z.coerce.number().min(1).max(6).optional().nullable(), // SAT 1-6
    acidityScore: nullableNumber(0, 10), // SAT 0-10
    tanninScore: nullableNumber(0, 10), // SAT 0-10
    bodyScore: nullableNumber(0, 10), // SAT 0-10
    alcoholABV: nullableNumber(0, 100),
    finishScore: nullableNumber(0, 10), // SAT 0-10
    palateNotes: z.string().optional().nullable(),

    //総合評価
    qualityScore: nullableNumber(0, 10), // SAT 0-10
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
type WineImageValue = NonNullable<WineFormValues['images']>[number];

interface WineFormProps {
    defaultValues?: Partial<WineFormValues>;
    onSubmit: (values: WineFormValues) => Promise<void>;
    isSubmitting?: boolean;
    submitLabel?: string;
    persistKey?: string; // New prop for persistence key
    onWineTypeChange?: (type: string) => void;
    simpleMode?: boolean;
}

export interface WineFormHandle {
    clear: () => void;
}

const voiceWritableFields = [
    'clarity',
    'brightness',
    'sparkleIntensity',
    'appearanceOther',
    'intensity',
    'color',
    'noseIntensity',
    'noseCondition',
    'development',
    'oldNewWorld',
    'fruitsMaturity',
    'aromaNeutrality',
    'oakAroma',
    'aromas',
    'aromaOther',
    'sweetness',
    'acidityScore',
    'tanninScore',
    'bodyScore',
    'alcoholABV',
    'finishScore',
    'palateNotes',
    'qualityScore',
    'readiness',
    'rating',
    'notes',
] as const satisfies readonly (keyof WineFormValues)[];

type VoiceWritableField = typeof voiceWritableFields[number];
type DateValueOrigin = 'empty' | 'auto' | 'user' | 'savedOrDefault' | 'exif';

const voiceReplaceableDefaults: Partial<Record<keyof WineFormValues, unknown>> = {
    clarity: '澄んだ',
    brightness: '輝きのある',
    sparkleIntensity: '',
    intensity: null,
    color: null,
    noseIntensity: null,
    noseCondition: '良好 (Clean)',
    development: '若い',
    oldNewWorld: null,
    fruitsMaturity: null,
    aromaNeutrality: null,
    oakAroma: null,
    aromas: [],
    aromaOther: '',
    sweetness: 1,
    acidityScore: null,
    tanninScore: null,
    bodyScore: null,
    alcoholABV: null,
    finishScore: null,
    palateNotes: '',
    qualityScore: null,
    readiness: '今飲めるが熟成可能',
    rating: 3.5,
    notes: '',
};

const aiSearchWritableFields = [
    'producer',
    'country',
    'locality',
    'region',
    'mainVariety',
    'otherVarieties',
    'additionalInfo',
    'vintage',
    'importer',
    'wineType',
    'clarity',
    'brightness',
    'sparkleIntensity',
    'appearanceOther',
    'intensity',
    'color',
    'noseIntensity',
    'noseCondition',
    'development',
    'oldNewWorld',
    'fruitsMaturity',
    'aromaNeutrality',
    'oakAroma',
    'aromas',
    'aromaOther',
    'sweetness',
    'acidityScore',
    'tanninScore',
    'bodyScore',
    'alcoholABV',
    'finishScore',
    'palateNotes',
] as const satisfies readonly (keyof WineFormValues)[];

type AiSearchWritableField = typeof aiSearchWritableFields[number];

const aiSearchReplaceableDefaults: Partial<Record<keyof WineFormValues, unknown>> = {
    ...voiceReplaceableDefaults,
    producer: '',
    country: '',
    locality: '',
    region: '',
    mainVariety: '',
    otherVarieties: '',
    additionalInfo: '',
    vintage: '2022',
    importer: '',
    wineType: '赤',
};

function serializeVoiceValue(value: unknown) {
    return JSON.stringify(value ?? null);
}

function isEmptyVoiceValue(value: unknown) {
    return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

const WineForm = forwardRef<WineFormHandle, WineFormProps>(({ defaultValues, onSubmit, isSubmitting, submitLabel = '保存する', persistKey, onWineTypeChange, simpleMode = false }, ref) => {
    const dateValueOriginRef = useRef<DateValueOrigin>(defaultValues?.date ? 'savedOrDefault' : 'empty');
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
            locality_vocab_id: null,
            region: '',
            mainVariety: '',
            otherVarieties: '',
            referenceUrl: '',
            vintage: '2022',
            additionalInfo: '',

            intensity: null,
            color: null,
            rimRatio: 5.0,
            clarity: '澄んだ',
            brightness: '輝きのある',
            sparkleIntensity: '',
            appearanceOther: '',

            noseIntensity: null,
            noseCondition: '良好 (Clean)',
            development: '若い',
            oldNewWorld: null,
            aromaNeutrality: null,
            fruitsMaturity: null,
            oakAroma: null,
            aromas: [],
            aromaOther: '',

            sweetness: 1.0, // Dry
            acidityScore: null,
            tanninScore: null,
            bodyScore: null,
            alcoholABV: null,
            finishScore: null,
            palateNotes: '',

            qualityScore: null,
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
        resolver: zodResolver(wineFormSchema) as Resolver<WineFormValues>
    });

    // --- Persistence Logic ---
    useEffect(() => {
        if (!persistKey) return;

        // Load from sessionStorage on mount (tab specific)
        const saved = sessionStorage.getItem(persistKey);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                const hasSavedDate = typeof parsed.date === 'string' && parsed.date.trim() !== '';

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

                if (hasSavedDate) {
                    dateValueOriginRef.current = 'savedOrDefault';
                } else if (parsed.date && dateValueOriginRef.current === 'empty') {
                    dateValueOriginRef.current = 'auto';
                }

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
            referenceUrl: '',
            vintage: '2022',
            additionalInfo: '',
            importer: '',

            intensity: null,
            color: null,
            rimRatio: 5.0,
            clarity: '澄んだ',
            brightness: '輝きのある',
            sparkleIntensity: '',
            appearanceOther: '',

            noseIntensity: null,
            noseCondition: '良好 (Clean)',
            development: '若い',
            oldNewWorld: null,
            aromaNeutrality: null,
            fruitsMaturity: null,
            oakAroma: null,
            aromas: [],
            aromaOther: '',

            sweetness: 1.0,
            acidityScore: null,
            tanninScore: null,
            bodyScore: null,
            alcoholABV: null,
            finishScore: null,
            palateNotes: '',

            qualityScore: null,
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

        reset(freshDefaults);
        dateValueOriginRef.current = 'auto';

        // Also clear any "search result" state
        setIsAiExpanded(false);
        voiceTranscriptRef.current = '';
        setVoiceTranscript('');
        setTranscriptPanelOpen(false);
        voiceFieldValuesRef.current = {};
        aiSearchFieldValuesRef.current = {};
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
            locality_vocab_id: null,
            region: '',
            mainVariety: '',
            otherVarieties: '',
            referenceUrl: '',
            vintage: '2022',
            additionalInfo: '',
            intensity: null,
            color: null,
            rimRatio: 5.0,
            clarity: '澄んだ',
            brightness: '輝きのある',
            sparkleIntensity: '',
            appearanceOther: '',
            noseIntensity: null,
            noseCondition: '良好 (Clean)',
            development: '若い',
            oldNewWorld: null,
            aromaNeutrality: null,
            fruitsMaturity: null,
            oakAroma: null,
            aromas: [],
            aromaOther: '',
            sweetness: 1,
            acidityScore: null,
            tanninScore: null,
            bodyScore: null,
            alcoholABV: null,
            finishScore: null,
            palateNotes: '',
            qualityScore: null,
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
        dateValueOriginRef.current = 'auto';

        setIsAiExpanded(false);
        voiceTranscriptRef.current = '';
        setVoiceTranscript('');
        setTranscriptPanelOpen(false);
        voiceFieldValuesRef.current = {};
        aiSearchFieldValuesRef.current = {};
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    useImperativeHandle(ref, () => ({
        clear: handleClear
    }));

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
    const hasAiFormData = !!(
        watch('terroir_info') ||
        watch('producer_philosophy') ||
        watch('technical_details') ||
        watch('vintage_analysis') ||
        watch('search_result_tasting_note')
    );

    useEffect(() => {
        document.body.setAttribute('data-winetype', wineType ?? '');
        if (onWineTypeChange && wineType) {
            onWineTypeChange(wineType);
        }
    }, [wineType, onWineTypeChange]);

    // Accent Color Effect
    useEffect(() => {
        const root = document.documentElement;
        let accentColor = '#881337'; // default primary (burgundy)

        switch (wineType) {
            case '赤': accentColor = '#be123c'; break; // rose-700
            case '白': accentColor = '#f59e0b'; break; // amber-500
            case 'ロゼ': accentColor = '#ec4899'; break; // pink-500
            case 'オレンジ': accentColor = '#f97316'; break; // orange-500
            case '発泡白': accentColor = '#eab308'; break; // yellow-500
            case '発泡ロゼ': accentColor = '#fb7185'; break; // rose-400
        }
        root.style.setProperty('--accent', accentColor);
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
            dateValueOriginRef.current = 'auto';
        }
    }, [getValues, setValue]);

    // const filteredAromaGroups = ... (Removed legacy filtering logic)

    const isLocalhostUpload = () => {
        const { hostname } = window.location;
        return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
    };

    const uploadFileViaApi = async (file: File | Blob, filename: string): Promise<string> => {
        const formData = new FormData();
        formData.append('file', file, filename);
        formData.append('filename', filename);

        const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
        });

        const { getUrl, error } = await res.json();
        if (!res.ok || error) throw new Error(error || 'Upload failed');

        return getUrl;
    };

    const uploadFileViaSignedUrl = async (file: File | Blob, filename: string): Promise<string> => {
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

    const uploadFile = async (file: File | Blob, filename: string): Promise<string> => {
        if (isLocalhostUpload()) {
            return uploadFileViaApi(file, filename);
        }

        return uploadFileViaSignedUrl(file, filename);
    };

    const applyExifCaptureDateFromFirstPhoto = async (file: File) => {
        if (dateValueOriginRef.current !== 'empty' && dateValueOriginRef.current !== 'auto') return;

        const captureDate = await extractExifCaptureDate(file);
        if (!captureDate) return;

        const currentDate = getValues('date');
        if (currentDate && dateValueOriginRef.current !== 'auto') return;

        setValue('date', captureDate, { shouldDirty: true });
        dateValueOriginRef.current = 'exif';
    };

    const handleFilesSelect = async (files: FileList | null, options?: { autoAi?: boolean }) => {
        if (!files || files.length === 0) return;

        await applyExifCaptureDateFromFirstPhoto(files[0]);

        const newImages: WineImageValue[] = [];
        const currentImages = getValues('images') || [];
        const orderOffset = currentImages.length;

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
            const nextImages = [...currentImages, ...newImages];
            setValue('images', nextImages, { shouldDirty: true });

            if (options?.autoAi) {
                await runSimpleImageAiFlow(newImages[0].url);
            }
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
    const [voiceTranscript, setVoiceTranscript] = useState('');
    const [isInterpretingTranscript, setIsInterpretingTranscript] = useState(false);
    const [transcriptPanelOpen, setTranscriptPanelOpen] = useState(false);
    const [placeSuggestions, setPlaceSuggestions] = useState<string[]>([]);
    const voiceTranscriptRef = useRef('');
    const voiceFieldValuesRef = useRef<Partial<Record<keyof WineFormValues, string>>>({});
    const aiSearchFieldValuesRef = useRef<Partial<Record<keyof WineFormValues, string>>>({});

    useEffect(() => {
        let isMounted = true;

        const loadPlaceSuggestions = async () => {
            try {
                const response = await fetch('/api/place-suggestions', { cache: 'no-store' });
                if (!response.ok) return;

                const data = await response.json();
                if (isMounted && Array.isArray(data.suggestions)) {
                    setPlaceSuggestions(
                        data.suggestions.filter((item: unknown): item is string => typeof item === 'string')
                    );
                }
            } catch (error) {
                console.error('Failed to load place suggestions:', error);
            }
        };

        void loadPlaceSuggestions();

        return () => {
            isMounted = false;
        };
    }, []);


    const handleImageOptimizeAndAnalyze = async (targetImageUrl?: string): Promise<boolean> => {
        const currentImages = getValues('images') || [];
        const targetUrl = targetImageUrl || currentImages[0]?.url || getValues('imageUrl');
        if (!targetUrl) return false;

        try {
            setIsAnalyzing(true);
            const result = await optimizeAndAnalyzeWineImage(targetUrl);

            if (result.optimizedImage) {
                const optimized = result.optimizedImage;
                const sourceIndex = currentImages.findIndex((image) => image.url === targetUrl);
                const sourceImage: WineImageValue = sourceIndex >= 0 ? currentImages[sourceIndex] : {
                    url: targetUrl,
                    thumbnail_url: null,
                    storage_path: null,
                    display_order: 1,
                };
                const optimizedImage: WineImageValue = {
                    ...sourceImage,
                    url: optimized.url,
                    thumbnail_url: optimized.thumbnail_url,
                    storage_path: optimized.storage_path,
                    display_order: 0,
                };

                const remainingImages = currentImages.filter((image, index) => (
                    index !== sourceIndex &&
                    image.url !== sourceImage.url &&
                    image.url !== optimized.url
                ));
                const nextImages = [optimizedImage, sourceImage, ...remainingImages].map((image, index) => ({
                    ...image,
                    display_order: index,
                }));
                setValue('images', nextImages, { shouldDirty: true });

                setValue('imageUrl', optimized.url, { shouldDirty: true });
            }

            if (result.wineName) setValue('wineName', result.wineName, { shouldDirty: true });
            if (result.producer) setValue('producer', result.producer, { shouldDirty: true });
            if (result.vintage) setValue('vintage', result.vintage, { shouldDirty: true });
            if (result.country) setValue('country', result.country, { shouldDirty: true });
            if (result.locality) {
                setValue('locality', result.locality, { shouldDirty: true });
                setValue('locality_vocab_id', result.locality_vocab_id ?? null, { shouldDirty: true });
            }
            if (result.price !== null && result.price !== undefined && result.price > 0) {
                setValue('price', String(result.price), { shouldDirty: true });
            }
            return true;
        } catch (e) {
            console.error(e);
            alert('画像補正と銘柄検索に失敗しました');
            return false;
        } finally {
            setIsAnalyzing(false);
        }
    };

    const canApplyAiSearchUpdate = useCallback((field: AiSearchWritableField) => {
        const currentValue = getValues(field);
        const currentSerialized = serializeVoiceValue(currentValue);
        const lastAiSearchValue = aiSearchFieldValuesRef.current[field];

        if (lastAiSearchValue !== undefined) {
            return currentSerialized === lastAiSearchValue;
        }

        if (isEmptyVoiceValue(currentValue)) {
            return true;
        }

        if (Object.prototype.hasOwnProperty.call(aiSearchReplaceableDefaults, field)) {
            return currentSerialized === serializeVoiceValue(aiSearchReplaceableDefaults[field]);
        }

        return false;
    }, [getValues]);

    const applyAiSearchUpdates = useCallback((updates: Record<string, unknown>) => {
        for (const [key, rawValue] of Object.entries(updates)) {
            if (!aiSearchWritableFields.includes(key as AiSearchWritableField)) continue;

            const field = key as AiSearchWritableField;
            if (!canApplyAiSearchUpdate(field)) continue;

            let value = rawValue;
            if (field === 'aromas' && Array.isArray(rawValue)) {
                value = Array.from(new Set(rawValue.filter((item): item is string => typeof item === 'string' && item.trim() !== '')));
            }

            if (field === 'wineType' && (typeof value !== 'string' || !wineTypes.includes(value as (typeof wineTypes)[number]))) continue;
            if (field === 'country' && (typeof value !== 'string' || !countries.includes(value as (typeof countries)[number]))) continue;
            if (field === 'mainVariety' && (typeof value !== 'string' || !mainVarieties.includes(value as (typeof mainVarieties)[number]))) continue;

            setValue(field, value as never, { shouldDirty: true });
            aiSearchFieldValuesRef.current[field] = serializeVoiceValue(value);
        }
    }, [canApplyAiSearchUpdate, setValue]);


    const handleAiSearch = async (options?: { silentIfMissingName?: boolean; revealOnSuccess?: boolean }): Promise<boolean> => {
        const name = getValues('wineName');
        const producer = getValues('producer');
        const vintage = getValues('vintage');
        const country = getValues('country');
        const locality = getValues('locality');
        const referenceUrl = getValues('referenceUrl');

        if (!name) {
            if (!options?.silentIfMissingName) {
                alert('ワイン名を入力してください');
            }
            return false;
        }

        setIsAiLoading(true);
        try {
            const result = await searchWineDetails(0, { // ID 0 as dummy for new/unsaved
                name,
                winery: producer || undefined,
                vintage: vintage || undefined,
                country: country || undefined,
                locality: locality || undefined,
                referenceUrl: referenceUrl || undefined,
            });

            setIsAiExpanded(true);
            setValue('terroir_info', result.terroir_info, { shouldDirty: true });
            setValue('producer_philosophy', result.producer_philosophy, { shouldDirty: true });
            setValue('technical_details', result.technical_details, { shouldDirty: true });
            setValue('vintage_analysis', result.vintage_analysis, { shouldDirty: true });
            setValue('search_result_tasting_note', result.search_result_tasting_note, { shouldDirty: true });
            if (simpleMode && result.form_updates) {
                applyAiSearchUpdates(result.form_updates as Record<string, unknown>);
            }
            if (options?.revealOnSuccess) {
                window.setTimeout(() => {
                    document.getElementById('ai-deep-dive')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 0);
            }
            return true;
        } catch (e) {
            console.error(e);
            alert('AI検索に失敗しました');
            return false;
        } finally {
            setIsAiLoading(false);
        }
    };

    const runSimpleImageAiFlow = async (targetImageUrl?: string) => {
        const analyzed = await handleImageOptimizeAndAnalyze(targetImageUrl);
        if (!analyzed) return;

        await handleAiSearch({ silentIfMissingName: true, revealOnSuccess: true });
    };

    const handleAiJump = () => {
        setIsAiExpanded(true);
        window.setTimeout(() => {
            document.getElementById('ai-deep-dive')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 0);
    };

    const getVoiceCurrentValues = useCallback(() => {
        const values = getValues();
        return voiceWritableFields.reduce((acc, field) => {
            acc[field] = values[field];
            return acc;
        }, {} as Record<string, unknown>);
    }, [getValues]);

    const canApplyVoiceUpdate = useCallback((field: VoiceWritableField) => {
        const currentValue = getValues(field);
        const currentSerialized = serializeVoiceValue(currentValue);
        const lastVoiceValue = voiceFieldValuesRef.current[field];

        if (lastVoiceValue !== undefined) {
            return currentSerialized === lastVoiceValue;
        }

        if (isEmptyVoiceValue(currentValue)) {
            return true;
        }

        if (Object.prototype.hasOwnProperty.call(voiceReplaceableDefaults, field)) {
            return currentSerialized === serializeVoiceValue(voiceReplaceableDefaults[field]);
        }

        return false;
    }, [getValues]);

    const applyVoiceUpdates = useCallback((updates: Record<string, unknown>) => {
        for (const [key, rawValue] of Object.entries(updates)) {
            if (!voiceWritableFields.includes(key as VoiceWritableField)) continue;

            const field = key as VoiceWritableField;
            if (!canApplyVoiceUpdate(field)) continue;

            let value = rawValue;
            if (field === 'aromas' && Array.isArray(rawValue)) {
                const currentAromas = getValues('aromas') || [];
                value = Array.from(new Set([...currentAromas, ...rawValue.filter((item): item is string => typeof item === 'string')]));
            }

            setValue(field, value as never, { shouldDirty: true });
            voiceFieldValuesRef.current[field] = serializeVoiceValue(value);
        }
    }, [canApplyVoiceUpdate, getValues, setValue]);

    const interpretVoiceTranscript = useCallback(async (transcript: string, recentText: string) => {
        if (!transcript.trim()) return;

        setIsInterpretingTranscript(true);
        try {
            const result = await interpretTastingTranscript({
                transcript,
                recentText,
                currentValues: getVoiceCurrentValues(),
            });

            applyVoiceUpdates(result.updates as Record<string, unknown>);
        } catch (error) {
            console.error('Transcript interpretation failed:', error);
        } finally {
            setIsInterpretingTranscript(false);
        }
    }, [applyVoiceUpdates, getVoiceCurrentValues]);

    const handleTranscriptChunk = useCallback((text: string) => {
        const cleaned = text.trim();
        if (!cleaned) return;

        const next = voiceTranscriptRef.current
            ? `${voiceTranscriptRef.current}\n${cleaned}`
            : cleaned;

        voiceTranscriptRef.current = next;
        setVoiceTranscript(next);
        void interpretVoiceTranscript(next, cleaned);
    }, [interpretVoiceTranscript]);

    const handleClearVoiceTranscript = useCallback(() => {
        voiceTranscriptRef.current = '';
        setVoiceTranscript('');
        voiceFieldValuesRef.current = {};
    }, []);

    const imageUploadFields = (
        <>
            <label className="block text-sm font-medium text-[var(--text)] mb-2">写真（複数選択可）</label>
            <input
                type="file"
                accept="image/*"
                multiple
                className="block w-full text-sm text-[var(--text-muted)] rounded-full border border-[var(--border)] p-2 bg-[var(--input-bg)]"
                onChange={(e) => {
                    void handleFilesSelect(e.target.files, { autoAi: simpleMode });
                    // Clear input so same files can be selected again if needed?
                    // e.target.value = ''; // Be careful with this in react
                }}
            />

            {(watch('images')?.length ?? 0) > 0 && (
                <div className="sm:col-span-3 mt-4 grid grid-cols-3 sm:grid-cols-4 gap-4">
                    {watch('images')?.map((img, idx) => (
                        <div key={idx} className="relative group aspect-square bg-[var(--app-bg)] rounded-lg overflow-hidden border border-[var(--border)]">
                            <img
                                src={img.thumbnail_url || img.url}
                                alt={`upload-${idx}`}
                                className="w-full h-full object-cover"
                            />
                            <button
                                type="button"
                                onClick={() => removeImage(idx)}
                                className="absolute top-1 right-1 bg-[var(--card-bg)]/80 p-1 rounded-full text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label="写真を削除"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {(watch('imageUrl') || watch('images')?.[0]?.url) && (
                <div className="sm:col-span-3 mt-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-gray-500">AI解析用メイン画像:</span>
                        {!watch('images') || watch('images')?.length === 0 ? (
                            <img src={watch('imageUrl')!} alt="main" className="h-10 w-10 object-cover rounded border border-[var(--border)]" />
                        ) : null}
                    </div>

                    <div className="mt-2">
                        <button
                            type="button"
                            onClick={() => void handleImageOptimizeAndAnalyze()}
                            disabled={isAnalyzing}
                            className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-md shadow-sm hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                            AI画像補正&銘柄検索
                        </button>
                        {simpleMode && (isAnalyzing || isAiLoading) ? (
                            <p className="text-[10px] text-[var(--text-muted)] mt-1">写真から自動入力しています</p>
                        ) : (
                            <p className="text-[10px] text-[var(--text-muted)] mt-1">※一枚目を補正し、元画像は二枚目に残します</p>
                        )}
                    </div>
                </div>
            )}
        </>
    );

    const wineInfoBackFields = (
        <>
            <div className="pt-2 border-t border-dashed border-[var(--border)]">
                <h4 className="text-sm font-semibold text-[var(--text)] mb-4">生産地</h4>
                <div className="grid sm:grid-cols-2 gap-6">
                    <FieldRow label="国">
                        <select className={FORM_CONTROL_BASE} {...register('country')}>
                            <option value="">未選択</option>
                            {countries.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </FieldRow>
                    <FieldRow label="地名（地域/村/畑など）">
                        <Controller
                            control={control}
                            name="locality"
                            render={({ field }) => (
                                <LocalityCombobox
                                    value={field.value ?? ''}
                                    onChange={field.onChange}
                                    countryJa={watch('country')}
                                    onSelectId={(id) => setValue('locality_vocab_id', id, { shouldDirty: true })}
                                    placeholder="例: ブルゴーニュ／ニュイ＝サン＝ジョルジュ／レ・ダモード"
                                    disabled={isSubmitting}
                                />
                            )}
                        />
                    </FieldRow>
                </div>
            </div>

            <div className="pt-2 border-t border-dashed border-[var(--border)]">
                <h4 className="text-sm font-semibold text-[var(--text)] mb-4">品種</h4>
                <div className="grid sm:grid-cols-2 gap-6">
                    <FieldRow label="主体の品種">
                        <select className={FORM_CONTROL_BASE} {...register('mainVariety')}>
                            <option value="">未選択</option>
                            {mainVarieties.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </FieldRow>
                    <FieldRow label="その他（補助品種・ブレンド等）">
                        <input className={FORM_CONTROL_BASE} placeholder="例: プティ・ヴェルド 5% など"
                            {...register('otherVarieties')} />
                    </FieldRow>
                </div>
            </div>

            <div className="pt-2">
                <FieldRow label="参考URL">
                    <input
                        className={FORM_CONTROL_BASE}
                        type="url"
                        placeholder="公式URL等を記載"
                        {...register('referenceUrl')}
                    />
                </FieldRow>
            </div>

            <div className="pt-2">
                <FieldRow label="補足情報（自由入力）">
                    <textarea
                        className={`${FORM_CONTROL_BASE} h-28`}
                        placeholder="例: 畑情報、区画、樹齢、醸造メモ、輸入元メモ、保存環境 など自由に"
                        {...register('additionalInfo')}
                    />
                </FieldRow>
            </div>
        </>
    );

    const personalRatingField = (
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
                                className="w-full accent-[var(--text)]"
                            />
                            <span className="w-12 text-right text-lg font-medium text-yellow-600">{round1(field.value).toFixed(1)}</span>
                        </div>
                    </>
                )}
            />
        </FieldRow>
    );

    const aiInfoTextareaClass = `${FORM_CONTROL_BASE} text-sm`;

    const aiInfoSection = (
        <section id="ai-deep-dive" className="rounded-2xl bg-[var(--card-bg)] p-4 border border-[var(--border)]">
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
                        <h2 className="font-bold text-[var(--text)]">AI情報</h2>
                        <p className="text-xs text-[var(--text-muted)]">
                            {isAiLoading ? 'Web上の専門情報を検索中' : hasAiFormData ? '取得済みの参考情報を確認' : 'ワイン情報パネル右上から取得'}
                        </p>
                    </div>
                </div>
                {isAiExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                    <ChevronDown className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--text)]" />
                )}
            </button>

            {isAiExpanded && (
                <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <p className="text-sm text-[var(--text-muted)] bg-[var(--surface-2)] p-3 rounded-lg border border-[var(--border)]">
                        ワイン名・生産者・ヴィンテージを元に、Web上の専門情報を検索します。
                        <br />
                        <span className="text-xs text-[var(--text-muted)] block mt-1">国名・地域名・参考URLが入力されている場合は、それらの情報も検索に活用されます。参考URLがある場合は必ず参照します。</span>
                        <span className="text-xs text-[var(--text-muted)] block mt-1">※ 既に情報が入力されている場合は上書きされます。</span>
                    </p>

                    {isAiLoading && (
                        <div className="flex items-center gap-2 rounded-lg border border-purple-100 bg-purple-50 px-3 py-2 text-sm text-purple-700">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            AI情報を取得しています
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-[var(--text)] flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-emerald-600" /> テロワール
                            </label>
                            <Controller
                                control={control}
                                name="terroir_info"
                                render={({ field }) => (
                                    <AutoGrowingTextarea
                                        className={aiInfoTextareaClass}
                                        value={field.value ?? ''}
                                        onChange={field.onChange}
                                        onBlur={field.onBlur}
                                        name={field.name}
                                        placeholder="AI検索結果がここに表示されます"
                                    />
                                )}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-[var(--text)] flex items-center gap-2">
                                <User className="w-4 h-4 text-blue-600" /> 生産者・哲学
                            </label>
                            <Controller
                                control={control}
                                name="producer_philosophy"
                                render={({ field }) => (
                                    <AutoGrowingTextarea
                                        className={aiInfoTextareaClass}
                                        value={field.value ?? ''}
                                        onChange={field.onChange}
                                        onBlur={field.onBlur}
                                        name={field.name}
                                    />
                                )}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-[var(--text)] flex items-center gap-2">
                                <Settings className="w-4 h-4 text-gray-600" /> 技術詳細
                            </label>
                            <Controller
                                control={control}
                                name="technical_details"
                                render={({ field }) => (
                                    <AutoGrowingTextarea
                                        className={aiInfoTextareaClass}
                                        value={field.value ?? ''}
                                        onChange={field.onChange}
                                        onBlur={field.onBlur}
                                        name={field.name}
                                    />
                                )}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-[var(--text)] flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-orange-600" /> ヴィンテージ分析
                            </label>
                            <Controller
                                control={control}
                                name="vintage_analysis"
                                render={({ field }) => (
                                    <AutoGrowingTextarea
                                        className={aiInfoTextareaClass}
                                        value={field.value ?? ''}
                                        onChange={field.onChange}
                                        onBlur={field.onBlur}
                                        name={field.name}
                                    />
                                )}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-[var(--text)] flex items-center gap-2">
                                <FileText className="w-4 h-4 text-red-600" /> 参考テイスティングノート
                            </label>
                            <Controller
                                control={control}
                                name="search_result_tasting_note"
                                render={({ field }) => (
                                    <AutoGrowingTextarea
                                        className={aiInfoTextareaClass}
                                        value={field.value ?? ''}
                                        onChange={field.onChange}
                                        onBlur={field.onBlur}
                                        name={field.name}
                                    />
                                )}
                            />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-[var(--border)] mt-4 text-center">
                        <p className="text-xs text-[var(--text-muted)]">
                            ※本情報は参考情報です。実際の評価はご自身の感覚を優先してください。
                        </p>
                    </div>
                </div>
            )}
        </section>
    );

    return (
        <form
            onSubmit={handleSubmit(handleFormSubmit)}
            className={`w-full space-y-8 ${simpleMode && transcriptPanelOpen ? 'pb-[calc(25vh+10rem+env(safe-area-inset-bottom))]' : 'pb-[calc(8rem+env(safe-area-inset-bottom))]'}`}
        >
            <SimpleRecordingControls
                enabled={simpleMode}
                transcript={voiceTranscript}
                isInterpreting={isInterpretingTranscript}
                panelOpen={transcriptPanelOpen}
                onPanelOpenChange={setTranscriptPanelOpen}
                onTranscriptChunk={handleTranscriptChunk}
                onClearTranscript={handleClearVoiceTranscript}
            />

            {!simpleMode && (
                <button
                    type="button"
                    onClick={handleAiJump}
                    title="AI情報へ移動"
                    aria-label="AI情報へ移動"
                    className="fixed right-4 bottom-32 z-40 hidden h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg transition-transform hover:scale-105 active:scale-95 sm:flex"
                >
                    {isAiLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Bot className="h-6 w-6" />}
                </button>
            )}

            {/* タブ：ワインタイプ */}
            <section className="mb-4">
                <div className="flex flex-wrap gap-2">
                    {wineTypes.map(t => {
                        const active = wineType === t;
                        return (
                            <button
                                key={t}
                                type="button"
                                className={`px-3 py-1.5 rounded-full border transition-colors ${active ? 'bg-[var(--text)] text-[var(--app-bg)] border-[var(--text)]' : 'bg-[var(--card-bg)] text-[var(--text-muted)] border-[var(--border)] hover:bg-[var(--app-bg)]'}`}
                                onClick={() => setValue('wineType', t, { shouldDirty: true })}
                            >
                                {t}
                            </button>
                        );
                    })}
                </div>
                <input type="hidden" {...register('wineType')} />
            </section>

            {simpleMode && (
                <SectionCard title="画像アップロード" icon={<ImageIcon size={18} />} tone="neutral">
                    {imageUploadFields}
                </SectionCard>
            )}

            {/* 基本情報 */}
            <SectionCard title="基本情報" icon={<Calendar size={18} />} tone="neutral">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <FieldRow label="日付">
                        <input
                            type="date"
                            className={FORM_CONTROL_BASE}
                            {...register('date', {
                                onChange: () => {
                                    dateValueOriginRef.current = 'user';
                                },
                            })}
                        />
                    </FieldRow>
                    <FieldRow label="飲んだ/購入した場所">
                        <input
                            className={FORM_CONTROL_BASE}
                            placeholder="例: 自宅 / ○○レストラン / △△ワインショップ"
                            list="place-suggestions"
                            {...register('place')} />
                        <datalist id="place-suggestions">
                            {placeSuggestions.map((place) => (
                                <option key={place} value={place} />
                            ))}
                        </datalist>
                    </FieldRow>
                </div>
                {!simpleMode && (
                    <div className="mt-6">
                        {imageUploadFields}
                    </div>
                )}

            </SectionCard>


            {/* ワイン情報 */}
            <SectionCard
                title="ワイン情報"
                icon={<FileText size={18} />}
                tone="neutral"
                right={
                    <button
                        type="button"
                        onClick={() => void handleAiSearch({ revealOnSuccess: simpleMode })}
                        disabled={isAiLoading || !hasWineName}
                        title={hasWineName ? 'AI情報を取得' : 'ワイン名を入力してください'}
                        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isAiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        AI情報取得
                    </button>
                }
            >
                <div className='grid grid-cols-1 gap-6'>
                    <FieldRow label="ワイン名*">
                        <input className={FORM_CONTROL_BASE} placeholder="例: Bourgogne Rouge" {...register('wineName')} />
                        {errors.wineName && <p className="text-red-500 text-sm mt-1">必須です</p>}
                    </FieldRow>

                    <div className="grid sm:grid-cols-2 gap-6">
                        <FieldRow label="生産者">
                            <input className={FORM_CONTROL_BASE} placeholder="例: Domaine X" {...register('producer')} />
                        </FieldRow>
                        <FieldRow label="ヴィンテージ">
                            <input className={FORM_CONTROL_BASE} placeholder="例: 2021" {...register('vintage')} />
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
                                                className={`${FORM_CONTROL_BASE} flex-1 text-right`}
                                                value={formatted}
                                                onChange={(e) => {
                                                    const raw = e.target.value.replace(/[^\d]/g, '');
                                                    field.onChange(raw);
                                                }}
                                                autoComplete="off" autoCorrect="off" autoCapitalize="none"
                                                placeholder="4,500"
                                            />
                                            <span className="text-[var(--text-muted)]">円</span>
                                        </div>
                                    </FieldRow>
                                );
                            }}

                        />
                        <FieldRow label="輸入元">
                            <input className={FORM_CONTROL_BASE} placeholder="Importer" {...register('importer')} />
                        </FieldRow>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-6">
                        <FieldRow label="色">
                            <input
                                type="text"
                                value={watch('wineType') ?? ''}
                                readOnly
                                className={`${FORM_CONTROL_BASE} bg-[var(--app-bg)] text-[var(--text-muted)] cursor-default`}
                            />
                        </FieldRow>
                        <div />
                    </div>

                    {!simpleMode && wineInfoBackFields}
                </div>
            </SectionCard>

            {simpleMode && (
                <SectionCard title="個人的な好み" icon={<Award size={18} />} tone="focus">
                    {personalRatingField}
                </SectionCard>
            )}

            {simpleMode && aiInfoSection}

            {simpleMode && (
                <SectionCard title="ワイン情報（生産地以降）" icon={<FileText size={18} />} tone="neutral">
                    <div className="grid grid-cols-1 gap-6">
                        {wineInfoBackFields}
                    </div>
                </SectionCard>
            )}


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
                            className={FORM_CONTROL_BASE}
                            {...register('clarity')}
                        >
                            {apperance.clarity.map(v => (
                                <option key={v.label} value={v.label}>{v.label}</option>
                            ))}
                        </select>
                    </FieldRow>
                    <FieldRow label="輝き">
                        <select className={FORM_CONTROL_BASE} {...register('brightness')}>
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
                        render={({ field }) => (
                            <NullableRangeField
                                label="濃淡 (Intensity)"
                                value={field.value}
                                min={0}
                                max={10}
                                step={0.5}
                                emptyValue={5}
                                labels={['淡', '濃']}
                                formatValue={(v) => `${v}: ${intensityLabel(v)}`}
                                onChange={field.onChange}
                            />
                        )}
                    />
                    <Controller
                        control={control}
                        name="color"
                        render={({ field }) => (
                            <NullableRangeField
                                label="色調 (Color)"
                                value={field.value}
                                min={0}
                                max={10}
                                step={0.5}
                                emptyValue={5}
                                labels={['淡/緑', '濃/褐']}
                                formatValue={(v) => `${v}: ${colorLabel(v, wineType)}`}
                                onChange={field.onChange}
                            />
                        )}
                    />
                </div>

                {/* Rim Ratio (Hidden from form as requested) */}

                {(isSparklingWhite || isSparklingRose) && (
                    <div className='mt-6'>
                        <FieldRow label="泡の強さ">
                            <select
                                className={FORM_CONTROL_BASE}
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
                            className={`${FORM_CONTROL_BASE} h-24`}
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
                        <select className={FORM_CONTROL_BASE} {...register('noseCondition')}>
                            {SAT_CONSTANTS.NOSE.CONDITION.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </FieldRow>
                    <FieldRow label="熟成段階">
                        <select className={FORM_CONTROL_BASE} {...register('development')}>
                            {SAT_CONSTANTS.NOSE.DEVELOPMENT.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </FieldRow>
                </div>

                <div className="space-y-8 mt-8">
                    <div>
                        <Controller
                            control={control}
                            name="noseIntensity"
                            render={({ field }) => (
                                <NullableRangeField
                                    label="香りの強さ"
                                    value={field.value}
                                    min={0}
                                    max={10}
                                    step={0.5}
                                    emptyValue={5}
                                    labels={['弱', '強']}
                                    formatValue={(v) => `${v}: ${noseIntensityLabel(v)}`}
                                    onChange={field.onChange}
                                />
                            )}
                        />
                    </div>

                    {/* Legacy / Auxiliary Sliders */}
                    {(isRed || isRose || isOrange) && (
                        <div>
                            <Controller
                                control={control}
                                name="oldNewWorld"
                                render={({ field }) => (
                                    <NullableRangeField
                                        label="旧/新世界"
                                        value={field.value}
                                        min={1}
                                        max={5}
                                        step={0.1}
                                        emptyValue={3}
                                        labels={['旧世界', '新世界']}
                                        formatValue={(value) => {
                                            const v = round1(value);
                                            return `${v.toFixed(1)}: ${v <= 3 ? '旧世界' : '新世界'}`;
                                        }}
                                        onChange={field.onChange}
                                    />
                                )}
                            />
                        </div>
                    )}

                    {isWhite && (
                        <div>
                            <Controller
                                control={control}
                                name="aromaNeutrality"
                                render={({ field }) => (
                                    <NullableRangeField
                                        label="ニュートラル / アロマティック"
                                        value={field.value}
                                        min={1}
                                        max={5}
                                        step={0.1}
                                        emptyValue={3}
                                        labels={['ニュートラル', 'アロマティック']}
                                        formatValue={(value) => {
                                            const v = round1(value);
                                            return `${v.toFixed(1)}: ${v <= 3 ? 'ニュートラル' : 'アロマティック'}`;
                                        }}
                                        onChange={field.onChange}
                                    />
                                )}
                            />
                        </div>
                    )}

                    <div className="pt-2">
                        <Controller
                            control={control}
                            name="oakAroma"
                            render={({ field }) => (
                                <NullableRangeField
                                    label="樽香"
                                    value={field.value}
                                    min={1}
                                    max={5}
                                    step={0.5}
                                    emptyValue={1}
                                    labels={['弱', '強']}
                                    formatValue={(value) => {
                                        const v = Math.round(value * 10) / 10;
                                        return `${v.toFixed(1)}: ${oakAromaLabel(v)}`;
                                    }}
                                    onChange={field.onChange}
                                />
                            )}
                        />
                    </div>
                </div>

                <div className="space-y-3 mt-10 border-t border-[var(--border)] pt-6">
                    <p className="text-sm font-semibold text-[var(--text)]">印象（アロマ）</p>
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
                        <select className={FORM_CONTROL_BASE} {...register('sweetness')}>
                            {SAT_CONSTANTS.PALATE.SWEETNESS.map((label, index) => (
                                <option key={label} value={index + 1}>{label}</option>
                            ))}
                        </select>
                    </FieldRow>

                    {/* Acidity */}
                    <Controller
                        control={control}
                        name="acidityScore"
                        render={({ field }) => (
                            <NullableRangeField
                                label="酸味"
                                value={field.value}
                                min={0}
                                max={10}
                                step={0.5}
                                emptyValue={5}
                                labels={['低', '高']}
                                formatValue={(v) => `${v}: ${palateElementLabel(v, 'acidity')}`}
                                onChange={field.onChange}
                            />
                        )}
                    />

                    {/* Tannin */}
                    {(isRed || isOrange) && (
                        <Controller
                            control={control}
                            name="tanninScore"
                            render={({ field }) => (
                                <NullableRangeField
                                    label="タンニン"
                                    value={field.value}
                                    min={0}
                                    max={10}
                                    step={0.5}
                                    emptyValue={5}
                                    labels={['低', '高']}
                                    formatValue={(v) => `${v}: ${palateElementLabel(v, 'tannin')}`}
                                    onChange={field.onChange}
                                />
                            )}
                        />
                    )}

                    {/* Alcohol */}
                    <FieldRow label="アルコール度数">
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                step="0.1"
                                className={`${FORM_CONTROL_BASE} text-right`}
                                {...register('alcoholABV', { valueAsNumber: true })}
                            />
                            <span className="text-sm">%</span>
                        </div>
                    </FieldRow>

                    {/* Body */}
                    <Controller
                        control={control}
                        name="bodyScore"
                        render={({ field }) => (
                            <NullableRangeField
                                label="ボディ"
                                value={field.value}
                                min={0}
                                max={10}
                                step={0.5}
                                emptyValue={5}
                                labels={['軽', '重']}
                                formatValue={(v) => `${v}: ${palateElementLabel(v, 'body')}`}
                                onChange={field.onChange}
                            />
                        )}
                    />

                    {/* Finish */}
                    <Controller
                        control={control}
                        name="finishScore"
                        render={({ field }) => (
                            <NullableRangeField
                                label="余韻"
                                value={field.value}
                                min={0}
                                max={10}
                                step={0.5}
                                emptyValue={5}
                                labels={['短', '長']}
                                formatValue={(v) => `${v}: ${finishLenLabel(v)}`}
                                onChange={field.onChange}
                            />
                        )}
                    />
                </div>

                <div className="mt-8">
                    <FieldRow label="味わいの補足" hint="例: 温度が上がると甘味の印象が増す、時間経過でタンニンが丸くなる 等">
                        <textarea
                            id="palateNotes"
                            className={`${FORM_CONTROL_BASE} h-24`}
                            {...register('palateNotes')}
                        />
                    </FieldRow>
                </div>
            </SectionCard>



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
                        render={({ field }) => (
                            <NullableRangeField
                                label="品質評価 (Quality)"
                                value={field.value}
                                min={0}
                                max={10}
                                step={0.5}
                                emptyValue={5}
                                labels={['低', '高']}
                                formatValue={(v) => `${v}: ${qualityLabel(v)}`}
                                onChange={field.onChange}
                            />
                        )}
                    />

                    <div className="grid sm:grid-cols-2 gap-6">
                        <FieldRow label="熟成の可能性 (Readiness)">
                            <select className={FORM_CONTROL_BASE} {...register('readiness')}>
                                {SAT_CONSTANTS.CONCLUSION.READINESS.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                        </FieldRow>
                    </div>

                    <FieldRow label="寸評 (Notes)">
                        <textarea className={`${FORM_CONTROL_BASE} h-28`} {...register('notes')} placeholder="自由記述" />
                    </FieldRow>

                    {!simpleMode && (
                        <div className="pt-6 border-t border-gray-100">
                            {personalRatingField}
                        </div>
                    )}
                </div>
            </SectionCard>

            {!simpleMode && aiInfoSection}

            <section className={`z-20 mt-8 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--card-bg)]/95 p-2 shadow-lg backdrop-blur-sm sm:sticky sm:rounded-2xl sm:p-4 ${simpleMode && transcriptPanelOpen ? 'sm:bottom-[calc(25vh+5.5rem+env(safe-area-inset-bottom))]' : 'sm:bottom-[calc(4rem+1rem+env(safe-area-inset-bottom))]'}`}>
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
                <div className="flex flex-row items-center justify-between gap-2 sm:gap-3">
                    <div className="w-[38%] sm:w-auto">
                        <button
                            type="button"
                            onClick={handleSaveDraft}
                            disabled={isSubmitting}
                            className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--app-bg)] px-3 text-sm font-bold text-[var(--text-muted)] shadow-sm transition-all hover:bg-[var(--border)] disabled:cursor-not-allowed disabled:opacity-50 sm:h-auto sm:w-auto sm:rounded-xl sm:px-6 sm:py-3 sm:text-base"
                        >
                            {isSubmitting ? '保存中...' : '一時保存'}
                        </button>
                    </div>
                    <div className="flex-1 sm:w-2/3 sm:flex-none">
                        <button
                            type="submit"
                            onClick={handlePublish}
                            disabled={isSubmitting}
                            className="h-11 w-full rounded-lg border border-blue-500/20 bg-gradient-to-r from-blue-600 to-indigo-600 px-5 text-sm font-bold text-white shadow-lg transition-all hover:shadow-xl active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 sm:h-auto sm:rounded-xl sm:px-8 sm:py-3 sm:text-base sm:hover:scale-[1.02]"
                        >
                            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : submitLabel}
                        </button>
                    </div>
                </div>
            </section>

            <style jsx global>{`
            .btn-primary { @apply rounded-xl bg-neutral-900 px-4 py-2 text-white shadow-sm hover:opacity-90 disabled:opacity-50; }
        `}</style>
        </form >
    );
});

WineForm.displayName = 'WineForm';

export default WineForm;

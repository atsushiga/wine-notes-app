"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { updateProfile } from "@/app/auth/actions";
import { User } from "@supabase/supabase-js";
import { Eye, EyeOff, Save, Loader2, Mic, SlidersHorizontal, ImageIcon, Search, Sparkles } from "lucide-react";
import { type SimpleAiAutomationSettings } from "@/lib/simpleAiAutomation";

const profileSchema = z.object({
    email: z.string().email("有効なメールアドレスを入力してください"),
    password: z.string().min(6, "パスワードは6文字以上である必要があります").optional().or(z.literal("")),
    defaultInputMode: z.enum(["simple", "detailed"]),
    simpleAutoImageOptimize: z.boolean(),
    simpleAutoWineNameSearch: z.boolean(),
    simpleAutoAiInfo: z.boolean(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type InputMode = ProfileFormValues["defaultInputMode"];

interface ProfileFormProps {
    user: User;
    defaultInputMode: InputMode;
    simpleAiAutomation: SimpleAiAutomationSettings;
}

export default function ProfileForm({ user, defaultInputMode, simpleAiAutomation }: ProfileFormProps) {
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
        setValue,
        control,
    } = useForm<ProfileFormValues>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            email: user.email || "",
            password: "",
            defaultInputMode,
            simpleAutoImageOptimize: simpleAiAutomation.imageOptimize,
            simpleAutoWineNameSearch: simpleAiAutomation.wineNameSearch,
            simpleAutoAiInfo: simpleAiAutomation.aiInfo,
        },
    });

    const selectedInputMode = useWatch({ control, name: "defaultInputMode" });
    const simpleAutoWineNameSearch = useWatch({ control, name: "simpleAutoWineNameSearch" });

    useEffect(() => {
        if (!simpleAutoWineNameSearch) {
            setValue("simpleAutoAiInfo", false, { shouldDirty: true });
        }
    }, [setValue, simpleAutoWineNameSearch]);

    const onSubmit = (data: ProfileFormValues) => {
        setMessage(null);
        startTransition(async () => {
            const formData = new FormData();
            formData.append("email", data.email);
            formData.append("defaultInputMode", data.defaultInputMode);
            formData.append("simpleAutoImageOptimize", String(data.simpleAutoImageOptimize));
            formData.append("simpleAutoWineNameSearch", String(data.simpleAutoWineNameSearch));
            formData.append("simpleAutoAiInfo", String(data.simpleAutoWineNameSearch && data.simpleAutoAiInfo));
            if (data.password) {
                formData.append("password", data.password);
            }

            const result = await updateProfile(formData);

            if (result?.error) {
                setMessage({ type: "error", text: result.error });
            } else if (result?.message) {
                setMessage({ type: "success", text: result.message });
                if (data.password) {
                    reset({
                        email: data.email,
                        password: "",
                        defaultInputMode: data.defaultInputMode,
                        simpleAutoImageOptimize: data.simpleAutoImageOptimize,
                        simpleAutoWineNameSearch: data.simpleAutoWineNameSearch,
                        simpleAutoAiInfo: data.simpleAutoWineNameSearch && data.simpleAutoAiInfo,
                    });
                }
            }
        });
    };

    const modeButtonClass = (active: boolean) => (
        `inline-flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 ${active
            ? "bg-gray-900 text-white shadow-sm"
            : "text-gray-500 hover:bg-white hover:text-gray-900"
        }`
    );

    const automationToggleClass = (disabled = false) => (
        `flex items-start gap-3 rounded-xl border p-3 transition-colors ${disabled
            ? "border-gray-100 bg-gray-50 text-gray-400"
            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
        }`
    );

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">アカウント情報</h2>

            {message && (
                <div
                    className={`p-4 mb-4 text-sm rounded-md ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                        }`}
                >
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
                    <input
                        type="email"
                        {...register("email")}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-gray-900"
                    />
                    {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">新しいパスワード (変更する場合のみ)</label>
                    <div className="relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            {...register("password")}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-gray-900"
                            placeholder="変更しない場合は空欄"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                    {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">デフォルト入力モード</label>
                    <div className="inline-flex w-full rounded-full border border-gray-200 bg-gray-100 p-1 shadow-sm">
                        <button
                            type="button"
                            onClick={() => setValue("defaultInputMode", "simple", { shouldDirty: true })}
                            aria-pressed={selectedInputMode === "simple"}
                            className={modeButtonClass(selectedInputMode === "simple")}
                        >
                            <Mic size={16} />
                            <span>簡単記録</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setValue("defaultInputMode", "detailed", { shouldDirty: true })}
                            aria-pressed={selectedInputMode === "detailed"}
                            className={modeButtonClass(selectedInputMode === "detailed")}
                        >
                            <SlidersHorizontal size={16} />
                            <span>こだわり入力</span>
                        </button>
                    </div>
                    <input type="hidden" {...register("defaultInputMode")} />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">簡単記録の画像アップロード後に自動実行するAI処理</label>
                    <div className="space-y-2">
                        <label className={automationToggleClass()}>
                            <input
                                type="checkbox"
                                {...register("simpleAutoImageOptimize")}
                                className="mt-1 h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                            />
                            <ImageIcon size={18} className="mt-0.5 shrink-0" />
                            <span>
                                <span className="block text-sm font-medium">画像補正</span>
                                <span className="block text-xs text-gray-500">アップロード画像をAIでラベル中心に補正します。</span>
                            </span>
                        </label>

                        <label className={automationToggleClass()}>
                            <input
                                type="checkbox"
                                {...register("simpleAutoWineNameSearch")}
                                className="mt-1 h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                            />
                            <Search size={18} className="mt-0.5 shrink-0" />
                            <span>
                                <span className="block text-sm font-medium">AI銘柄検索</span>
                                <span className="block text-xs text-gray-500">画像からワイン名・生産者・ヴィンテージなどを入力します。</span>
                            </span>
                        </label>

                        <label className={automationToggleClass(!simpleAutoWineNameSearch)}>
                            <input
                                type="checkbox"
                                {...register("simpleAutoAiInfo")}
                                disabled={!simpleAutoWineNameSearch}
                                className="mt-1 h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                            <Sparkles size={18} className="mt-0.5 shrink-0" />
                            <span>
                                <span className="block text-sm font-medium">AI情報取得</span>
                                <span className="block text-xs text-gray-500">AI銘柄検索で得た銘柄情報をもとに参考情報を取得します。</span>
                                {!simpleAutoWineNameSearch && (
                                    <span className="mt-1 block text-xs text-gray-400">AI銘柄検索をオンにすると選択できます。</span>
                                )}
                            </span>
                        </label>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isPending}
                    className="w-full flex items-center justify-center space-x-2 bg-rose-600 text-white py-2 px-4 rounded-md hover:bg-rose-700 transition-colors disabled:opacity-50"
                >
                    {isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    <span>保存する</span>
                </button>
            </form>
        </div>
    );
}

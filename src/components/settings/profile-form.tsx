"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { updateProfile } from "@/app/auth/actions";
import { User } from "@supabase/supabase-js";
import { Eye, EyeOff, Save, Loader2, Mic, SlidersHorizontal, ImageIcon, Search, Sparkles } from "lucide-react";
import { type SimpleAiAutomationSettings } from "@/lib/simpleAiAutomation";
import { FORM_CONTROL_BASE } from "@/constants/styles";

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
    const pendingEmail = user.new_email && user.new_email !== user.email ? user.new_email : "";

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
        `inline-flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${active
            ? "bg-[var(--text)] text-[var(--card-bg)] shadow-sm"
            : "text-[var(--text-muted)] hover:bg-[var(--card-bg)] hover:text-[var(--text)]"
        }`
    );

    const automationToggleClass = (disabled = false) => (
        `flex items-start gap-3 rounded-xl border p-3 transition-colors ${disabled
            ? "border-[var(--border-subtle)] bg-[var(--surface-2)]/65 text-[var(--text-muted)]"
            : "border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-soft)] hover:border-[var(--text-muted)]"
        }`
    );

    return (
        <div className="bg-[var(--card-bg)] p-6 rounded-lg shadow-[var(--shadow-card)] border border-[var(--border)]">
            <h2 className="text-lg font-semibold text-[var(--text)] mb-4">アカウント情報</h2>

            {message && (
                <div
                    className={`p-4 mb-4 text-sm rounded-md ${message.type === "success" ? "bg-[var(--color-success-soft)] text-[var(--color-success)]" : "bg-[var(--color-error-soft)] text-[var(--color-error)]"
                        }`}
                >
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                    <label htmlFor="settings-email" className="block text-sm font-medium text-[var(--text)] mb-1">メールアドレス</label>
                    <input
                        id="settings-email"
                        type="email"
                        {...register("email")}
                        aria-describedby="settings-email-help"
                        className={FORM_CONTROL_BASE}
                    />
                    <p id="settings-email-help" className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                        変更すると新しいメールアドレス宛に確認メールが送信されます。メール内のリンクを開くまで、現在のメールアドレスでログインできます。
                    </p>
                    {pendingEmail && (
                        <p className="mt-2 rounded-md border border-[var(--color-gold)]/30 bg-[var(--color-gold-soft)] px-3 py-2 text-xs leading-5 text-[var(--color-gold)]" role="status">
                            {pendingEmail} への変更確認が未完了です。確認メールのリンクを開くと変更が反映されます。
                        </p>
                    )}
                    {errors.email && <p className="text-[var(--color-error)] text-xs mt-1">{errors.email.message}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-[var(--text)] mb-1">新しいパスワード (変更する場合のみ)</label>
                    <div className="relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            {...register("password")}
                            className={`${FORM_CONTROL_BASE} pr-10`}
                            placeholder="変更しない場合は空欄"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                    {errors.password && <p className="text-[var(--color-error)] text-xs mt-1">{errors.password.message}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-[var(--text)] mb-2">デフォルト入力モード</label>
                    <div className="inline-flex w-full rounded-full border border-[var(--border)] bg-[var(--surface-2)] p-1 shadow-sm">
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
                    <label className="block text-sm font-medium text-[var(--text)] mb-2">簡単記録の画像アップロード後に自動実行するAI処理</label>
                    <div className="space-y-2">
                        <label className={automationToggleClass()}>
                            <input
                                type="checkbox"
                                {...register("simpleAutoImageOptimize")}
                                className="mt-1 h-4 w-4 rounded border-[var(--border)] accent-[var(--primary)] focus:ring-[var(--ring)]"
                            />
                            <ImageIcon size={18} className="mt-0.5 shrink-0" />
                            <span>
                                <span className="block text-sm font-medium">画像補正</span>
                                <span className="block text-xs text-[var(--text-muted)]">アップロード画像をAIでラベル中心に補正します。</span>
                            </span>
                        </label>

                        <label className={automationToggleClass()}>
                            <input
                                type="checkbox"
                                {...register("simpleAutoWineNameSearch")}
                                className="mt-1 h-4 w-4 rounded border-[var(--border)] accent-[var(--primary)] focus:ring-[var(--ring)]"
                            />
                            <Search size={18} className="mt-0.5 shrink-0" />
                            <span>
                                <span className="block text-sm font-medium">AI銘柄検索</span>
                                <span className="block text-xs text-[var(--text-muted)]">画像からワイン名・生産者・ヴィンテージなどを入力します。</span>
                            </span>
                        </label>

                        <label className={automationToggleClass(!simpleAutoWineNameSearch)}>
                            <input
                                type="checkbox"
                                {...register("simpleAutoAiInfo")}
                                disabled={!simpleAutoWineNameSearch}
                                className="mt-1 h-4 w-4 rounded border-[var(--border)] accent-[var(--primary)] focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50"
                            />
                            <Sparkles size={18} className="mt-0.5 shrink-0" />
                            <span>
                                <span className="block text-sm font-medium">AI情報取得</span>
                                <span className="block text-xs text-[var(--text-muted)]">AI銘柄検索で得た銘柄情報をもとに参考情報を取得します。</span>
                                {!simpleAutoWineNameSearch && (
                                    <span className="mt-1 block text-xs text-[var(--text-muted)]">AI銘柄検索をオンにすると選択できます。</span>
                                )}
                            </span>
                        </label>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isPending}
                    className="w-full flex items-center justify-center space-x-2 bg-[var(--primary)] text-[var(--primary-foreground)] py-2 px-4 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                    {isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    <span>保存する</span>
                </button>
            </form>
        </div>
    );
}

"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { updateProfile } from "@/app/auth/actions";
import { User } from "@supabase/supabase-js";
import { Eye, EyeOff, Save, Loader2 } from "lucide-react";

const profileSchema = z.object({
    email: z.string().email("有効なメールアドレスを入力してください"),
    password: z.string().min(6, "パスワードは6文字以上である必要があります").optional().or(z.literal("")),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileFormProps {
    user: User;
}

export default function ProfileForm({ user }: ProfileFormProps) {
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm<ProfileFormValues>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            email: user.email || "",
            password: "",
        },
    });

    const onSubmit = (data: ProfileFormValues) => {
        setMessage(null);
        startTransition(async () => {
            const formData = new FormData();
            formData.append("email", data.email);
            if (data.password) {
                formData.append("password", data.password);
            }

            const result = await updateProfile(formData);

            if (result?.error) {
                setMessage({ type: "error", text: result.error });
            } else if (result?.message) {
                setMessage({ type: "success", text: result.message });
                if (data.password) {
                    reset({ password: "" });
                }
            }
        });
    };

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

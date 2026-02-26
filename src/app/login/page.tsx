"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { login } from "./actions";
import logoImage from "@/app/icon_transparent.png";
import { Card } from "@/components/ui/Card";
import { FORM_CONTROL_BASE } from "@/constants/styles";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
    invalid_callback: "確認リンクが無効か、期限切れです。もう一度招待メールを送信してください。",
    exchange_failed: "セッションの確立に失敗しました。もう一度お試しください。",
    no_user: "認証情報の取得に失敗しました。もう一度お試しください。",
};

function LoginPageContent() {
    const searchParams = useSearchParams();
    const [isLoading, setIsLoading] = useState(false);
    const errorCode = searchParams.get("error");
    const error = errorCode ? (AUTH_ERROR_MESSAGES[errorCode] ?? errorCode) : null;

    return (
        <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#0b1226] via-[#0f1b3d] to-[#151a34] px-4 py-12 sm:px-6">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(3,7,18,0.62)_100%)]" />

            <div className="relative mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-md flex-col items-center justify-center gap-8">
                <div className="text-center">
                    <Image
                        src={logoImage}
                        alt="WINE NOTE ロゴ"
                        width={80}
                        height={80}
                        className="mx-auto mb-6"
                        priority
                    />
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-300">
                        WINE NOTE
                    </p>
                    <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-300">
                        ログイン
                    </h1>
                    <p className="mt-2 text-sm text-gray-400/70">
                        ワインの記録を続けるためにログインしてください
                    </p>
                </div>

                <Card className="w-full rounded-3xl border border-slate-700/60 bg-slate-900/75 p-6 shadow-2xl shadow-slate-950/40 backdrop-blur-sm sm:p-7">
                    <form
                        className="space-y-5"
                        action={login}
                        onSubmit={() => setIsLoading(true)}
                    >
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="email-address" className="mb-2 block text-sm font-medium text-slate-300">
                                    メールアドレス
                                </label>
                                <input
                                    id="email-address"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    className={`${FORM_CONTROL_BASE} rounded-xl border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm focus:ring-blue-400/70`}
                                    placeholder="you@example.com"
                                />
                            </div>
                            <div>
                                <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-300">
                                    パスワード
                                </label>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    className={`${FORM_CONTROL_BASE} rounded-xl border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm focus:ring-blue-400/70`}
                                    placeholder="パスワードを入力"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-xl border border-red-900/60 bg-red-950/35 p-3 text-sm text-red-200">
                                <h3 className="font-semibold text-red-100">ログインに失敗しました</h3>
                                <div className="mt-1">
                                    <p>{error}</p>
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`flex h-12 w-full items-center justify-center gap-2 rounded-full border border-blue-400/20 bg-gradient-to-r from-blue-600 to-purple-600 px-8 text-sm font-bold text-white shadow-lg shadow-indigo-950/50 focus:outline-none focus:ring-2 focus:ring-blue-400/70 ${
                                isLoading
                                    ? "cursor-not-allowed opacity-80"
                                    : "transition-all hover:scale-[1.01] hover:from-blue-500 hover:to-purple-500 active:scale-[0.99]"
                            }`}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    ログイン中...
                                </>
                            ) : (
                                "ログイン"
                            )}
                        </button>

                        <div className="pt-1 text-center">
                            <Link
                                href="/signup"
                                className="text-sm font-medium text-red-300/80 transition-colors hover:text-red-200"
                            >
                                アカウントを作成する
                            </Link>
                        </div>
                    </form>
                </Card>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <LoginPageContent />
        </Suspense>
    );
}

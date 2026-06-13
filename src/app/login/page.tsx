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
    invalid_credentials: "メールアドレスまたはパスワードが正しくありません。",
    auth_unavailable: "ログイン処理中に問題が発生しました。しばらくしてからもう一度お試しください。",
    invalid_callback: "確認リンクが無効か、期限切れです。もう一度確認メールを送信してください。",
    exchange_failed: "セッションの確立に失敗しました。もう一度お試しください。",
    no_user: "認証情報の取得に失敗しました。もう一度お試しください。",
};

function LoginPageContent() {
    const searchParams = useSearchParams();
    const [isLoading, setIsLoading] = useState(false);
    const errorCode = searchParams.get("error");
    const error = errorCode ? (AUTH_ERROR_MESSAGES[errorCode] ?? errorCode) : null;

    return (
        <div className="relative min-h-screen overflow-hidden bg-[var(--app-bg)] px-4 py-12 text-[var(--text)] sm:px-6">
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
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--color-gold)]">
                        WINE NOTE
                    </p>
                    <h1 className="mt-3 text-2xl font-bold tracking-tight text-[var(--text)]">
                        ログイン
                    </h1>
                    <p className="mt-2 text-sm text-[var(--text-muted)]">
                        ワインの記録を続けるためにログインしてください
                    </p>
                </div>

                <Card className="w-full rounded-3xl border-[var(--border)] bg-[var(--card-bg)] p-6 shadow-[var(--shadow-card-elevated)] sm:p-7">
                    <form
                        className="space-y-5"
                        action={login}
                        onSubmit={() => setIsLoading(true)}
                    >
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="email-address" className="mb-2 block text-sm font-medium text-[var(--text)]">
                                    メールアドレス
                                </label>
                                <input
                                    id="email-address"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    className={`${FORM_CONTROL_BASE} rounded-xl border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm`}
                                    placeholder="you@example.com"
                                />
                            </div>
                            <div>
                                <label htmlFor="password" className="mb-2 block text-sm font-medium text-[var(--text)]">
                                    パスワード
                                </label>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    className={`${FORM_CONTROL_BASE} rounded-xl border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm`}
                                    placeholder="パスワードを入力"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-xl border border-[var(--color-error)]/30 bg-[var(--color-error-soft)] p-3 text-sm text-[var(--color-error)]">
                                <h3 className="font-semibold">ログインに失敗しました</h3>
                                <div className="mt-1">
                                    <p>{error}</p>
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`flex h-12 w-full items-center justify-center gap-2 rounded-full border border-[var(--primary)] bg-[var(--primary)] px-8 text-sm font-bold text-[var(--primary-foreground)] shadow-[var(--shadow-card)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] ${
                                isLoading
                                    ? "cursor-not-allowed opacity-80"
                                    : "transition-all hover:scale-[1.01] hover:opacity-90 active:scale-[0.99]"
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
                                className="text-sm font-medium text-[var(--primary-text)] transition-colors hover:opacity-80"
                            >
                                アカウントを作成する
                            </Link>
                            <span className="mx-2 text-sm text-[var(--text-muted)]">/</span>
                            <Link
                                href="/reset-password"
                                className="text-sm font-medium text-[var(--primary-text)] transition-colors hover:opacity-80"
                            >
                                パスワードを忘れた
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

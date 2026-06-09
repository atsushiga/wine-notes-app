import type { Metadata } from "next";
import Link from "next/link";

const SUPPORT_EMAIL = "support@wine-note.jp";

export const metadata: Metadata = {
    title: "問い合わせ",
};

export default function ContactPage() {
    return (
        <main className="mx-auto max-w-2xl px-4 py-10 pb-24 text-[var(--text)]">
            <h1 className="text-2xl font-bold">問い合わせ</h1>
            <p className="mt-4 text-sm leading-7 text-[var(--text-muted)]">
                不具合、退会後のデータ削除確認、規約やプライバシーに関する問い合わせは、下記メールアドレスまで連絡してください。
            </p>
            <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="mt-6 inline-flex rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)]"
            >
                {SUPPORT_EMAIL}
            </a>
            <div className="mt-8 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-4 text-sm leading-7 text-[var(--text-muted)]">
                問い合わせ時は、登録メールアドレス、発生日時、操作内容を含めてください。ワイン画像やAI生成結果に関する問い合わせでは、対象の記録が分かる情報を添えてください。
            </div>
            <p className="mt-6 text-sm">
                <Link href="/settings" className="underline underline-offset-4">
                    設定に戻る
                </Link>
            </p>
        </main>
    );
}

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "プライバシーポリシー",
};

export default function PrivacyPage() {
    return (
        <main className="mx-auto max-w-3xl px-4 py-10 pb-24 text-[var(--text)]">
            <h1 className="text-2xl font-bold">プライバシーポリシー</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">最終更新日: 2026年6月10日</p>

            <section className="mt-8 space-y-4 text-sm leading-7">
                <p>
                    Wine Notes は、サービス提供、認証、記録保存、AI処理、問い合わせ対応、セキュリティ確保のために必要な情報を取り扱います。
                </p>
                <h2 className="text-lg font-semibold">取得する情報</h2>
                <p>
                    メールアドレス、認証情報、プロフィール設定、テイスティング記録、ワイン画像、音声入力、AI生成履歴、利用量イベント、アクセスに関する技術情報を取得する場合があります。
                </p>
                <h2 className="text-lg font-semibold">AI処理</h2>
                <p>
                    ラベル画像、銘柄情報、音声入力、テイスティング内容は、文字起こし、画像解析、参考情報生成、画像生成のために外部AIサービスへ送信される場合があります。
                </p>
                <h2 className="text-lg font-semibold">保存と削除</h2>
                <p>
                    利用者の記録と画像は、認証された本人のみが利用できるよう保存します。退会時には、プロフィール、記録、画像、AI解説履歴を削除します。
                </p>
                <h2 className="text-lg font-semibold">第三者提供</h2>
                <p>
                    法令に基づく場合、サービス運用に必要な委託先を利用する場合、不正利用防止に必要な場合を除き、個人情報を第三者へ販売しません。
                </p>
                <h2 className="text-lg font-semibold">問い合わせ</h2>
                <p>
                    個人情報の取り扱いに関する問い合わせは <Link href="/contact" className="underline underline-offset-4">問い合わせページ</Link> から行ってください。
                </p>
            </section>
        </main>
    );
}

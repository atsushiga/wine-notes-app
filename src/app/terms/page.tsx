import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "利用規約",
};

export default function TermsPage() {
    return (
        <main className="mx-auto max-w-3xl px-4 py-10 pb-24 text-[var(--text)]">
            <h1 className="text-2xl font-bold">利用規約</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">最終更新日: 2026年6月10日</p>

            <section className="mt-8 space-y-4 text-sm leading-7">
                <p>
                    Wine Notes は、ワインのテイスティング記録、画像管理、AIによる参考情報生成を提供する個人向けサービスです。
                    利用者は、自身の責任で記録内容を作成し、法令と公序良俗に反しない範囲で本サービスを利用するものとします。
                </p>
                <h2 className="text-lg font-semibold">AI生成情報</h2>
                <p>
                    AIが生成する銘柄情報、価格推定、テロワール、生産者情報、テイスティング傾向、画像は参考情報です。
                    内容の正確性、完全性、最新性を保証するものではありません。重要な判断には公式情報や専門家の確認を併用してください。
                </p>
                <h2 className="text-lg font-semibold">アップロード内容</h2>
                <p>
                    利用者は、アップロードする画像や音声について必要な権利を有しているものとします。
                    他者の個人情報、機密情報、権利侵害となる内容のアップロードは禁止します。
                </p>
                <h2 className="text-lg font-semibold">禁止事項</h2>
                <p>
                    不正アクセス、過度なリクエスト、AI/API利用量制限の回避、サービス運用を妨げる行為、第三者の権利を侵害する行為を禁止します。
                </p>
                <h2 className="text-lg font-semibold">飲酒に関する注意</h2>
                <p>
                    未成年の飲酒は法律で禁止されています。飲酒は適量を守り、飲酒運転をしないでください。
                </p>
                <h2 className="text-lg font-semibold">退会</h2>
                <p>
                    利用者は設定画面から退会できます。退会時には、プロフィール、テイスティング記録、画像、AI解説履歴を削除します。
                </p>
                <h2 className="text-lg font-semibold">問い合わせ</h2>
                <p>
                    本規約に関する問い合わせは <Link href="/contact" className="underline underline-offset-4">問い合わせページ</Link> から行ってください。
                </p>
            </section>
        </main>
    );
}

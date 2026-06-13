import Link from "next/link";
import { ContentContainer } from "@/components/layout/ContentContainer";

export default function OfflinePage() {
  return (
    <ContentContainer size="form" className="pb-32">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] px-5 py-6 shadow-sm">
        <p className="text-sm font-semibold text-[var(--color-error)]">オフラインです</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text)]">
          接続が戻ったらもう一度開いてください
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
          この画面はPWAのオフラインフォールバックです。入力中の内容はブラウザ内の下書きに残ります。
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)]"
        >
          記録画面に戻る
        </Link>
      </section>
    </ContentContainer>
  );
}

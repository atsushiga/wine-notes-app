import { Download } from "lucide-react";

export default function DataExportSection() {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-5 shadow-[var(--shadow-card)]">
      <h2 className="text-base font-semibold text-[var(--text)]">データエクスポート</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
        プロフィール、テイスティング記録、画像メタデータ、AI解説履歴をJSON形式でダウンロードできます。
      </p>
      <a
        href="/api/export"
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--card-bg)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
      >
        <Download size={18} />
        JSONをダウンロード
      </a>
    </div>
  );
}

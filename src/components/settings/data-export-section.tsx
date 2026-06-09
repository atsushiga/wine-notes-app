import { Download } from "lucide-react";

export default function DataExportSection() {
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">データエクスポート</h2>
      <p className="mt-2 text-sm leading-6 text-gray-600">
        プロフィール、テイスティング記録、画像メタデータ、AI解説履歴をJSON形式でダウンロードできます。
      </p>
      <a
        href="/api/export"
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
      >
        <Download size={18} />
        JSONをダウンロード
      </a>
    </div>
  );
}

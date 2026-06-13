import { ContentContainer } from "@/components/layout/ContentContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Sparkles } from "lucide-react";
import AiExplainerClient from "./AiExplainerClient";
import AiExplainerHistory from "./AiExplainerHistory";

export default function AiExplainerPage() {
    return (
        <ContentContainer size="form" className="pb-36">
            <PageHeader
                title="AIワイン解説"
                subtitle="ラベルから銘柄を読み取り、講座資料のような解説ページを生成"
                accentColor="var(--primary)"
                actions={
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card-bg)] text-[var(--primary-text)]">
                        <Sparkles size={18} />
                    </div>
                }
            />
            <AiExplainerClient />
            <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-xs leading-6 text-[var(--text-muted)]">
                AIが生成する解説、価格推定、画像は参考情報です。公式情報や実際のテイスティング内容と照合して利用してください。
            </p>
            <AiExplainerHistory />
        </ContentContainer>
    );
}

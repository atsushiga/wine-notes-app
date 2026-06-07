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
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card-bg)] text-[var(--primary)]">
                        <Sparkles size={18} />
                    </div>
                }
            />
            <AiExplainerClient />
            <AiExplainerHistory />
        </ContentContainer>
    );
}

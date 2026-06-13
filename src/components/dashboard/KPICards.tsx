
import React from 'react';
import { MetricCard } from '@/components/ui/primitives';

interface KPICardsProps {
    totalWines: number;
    recentWines: number;
    startDate: string | null;
    averagePrice: number | null;
    aiAnalyzed: number;
}

const KPICards: React.FC<KPICardsProps> = ({ totalWines, recentWines, startDate, averagePrice, aiAnalyzed }) => {
    return (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
                label="総テイスティング本数"
                value={<>{totalWines}<span className="ml-1 text-base font-normal text-[var(--text-muted)]">本</span></>}
                detail={startDate ? `${startDate}〜` : '記録開始日なし'}
            />
            <MetricCard
                label="直近1ヶ月"
                value={<>{recentWines}<span className="ml-1 text-base font-normal text-[var(--text-muted)]">本</span></>}
                detail="最近の記録ペース"
                accent="wine"
            />
            <MetricCard
                label="平均価格"
                value={averagePrice ? `¥${averagePrice.toLocaleString()}` : '-'}
                detail="価格入力済みの平均"
            />
            <MetricCard
                label="AI分析済み"
                value={<>{aiAnalyzed}<span className="ml-1 text-base font-normal text-[var(--text-muted)]">本</span></>}
                detail={totalWines ? `${Math.round((aiAnalyzed / totalWines) * 100)}% analyzed` : '分析データなし'}
                accent="gold"
            />
        </div>
    );
};

export default KPICards;

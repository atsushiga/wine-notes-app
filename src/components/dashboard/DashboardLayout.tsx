
'use client';

import React, { useMemo } from 'react';
import { ContentContainer } from '@/components/layout/ContentContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { InsightPanel } from '@/components/ui/primitives';
import { TastingNote } from '@/types/custom';
import KPICards from './KPICards';
import WineTypeDistChart from './WineTypeDistChart';
import PriceHistogram from './PriceHistogram';
import CostPerformanceScatter from './CostPerformanceScatter';
import DrinkingTrendChart from './DrinkingTrendChart';
import RegionMap from './RegionMap';
import {
    calculateWineTypeStats,
    calculatePriceDistribution,
    calculateTrend,
    groupByCountry,
    winesInLast30Days,
    calculateEarliestDate
} from '@/utils/statistics';

interface Props {
    notes: TastingNote[];
}

const DashboardLayout: React.FC<Props> = ({ notes }) => {
    const totalWines = notes.length;

    const recentWines = useMemo(() => winesInLast30Days(notes), [notes]);
    const wineTypeStats = useMemo(() => calculateWineTypeStats(notes), [notes]);
    const priceDist = useMemo(() => calculatePriceDistribution(notes), [notes]);
    const trendData = useMemo(() => calculateTrend(notes), [notes]);
    const regionData = useMemo(() => groupByCountry(notes), [notes]);
    const startDate = useMemo(() => calculateEarliestDate(notes), [notes]);
    const averagePrice = useMemo(() => {
        const prices = notes.map((note) => note.price).filter((price): price is number => typeof price === 'number' && Number.isFinite(price));
        if (prices.length === 0) return null;
        return Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length);
    }, [notes]);
    const aiAnalyzed = useMemo(() => notes.filter((note) => Boolean(note.ai_explanation_id || note.terroir_info || note.producer_philosophy)).length, [notes]);
    const pattern = useMemo(() => buildWinePattern(notes), [notes]);

    return (
        <ContentContainer size="wide" className="py-8">
            <PageHeader
                title="ワイン統計"
                subtitle="好みの傾向と記録ペースを読む"
            />

            <KPICards
                totalWines={totalWines}
                recentWines={recentWines}
                startDate={startDate}
                averagePrice={averagePrice}
                aiAnalyzed={aiAnalyzed}
            />

            <div className="mb-6">
                <InsightPanel title="Your Wine Pattern">
                    {pattern}
                </InsightPanel>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Left Column: A and D */}
                <div className="flex flex-col gap-6">
                    <WineTypeDistChart data={wineTypeStats} />
                    <DrinkingTrendChart data={trendData} />
                </div>

                {/* Right Column: B (Price Histogram) */}
                <div className="h-full">
                    <PriceHistogram data={priceDist} />
                </div>
            </div>

            {/* Bottom: C (Cost Performance) */}
            <div className="mb-6">
                <CostPerformanceScatter notes={notes} />
            </div>

            <div className="mb-8">
                <RegionMap data={regionData} />
            </div>

        </ContentContainer>
    );
};

export default DashboardLayout;

function buildWinePattern(notes: TastingNote[]) {
    if (notes.length === 0) {
        return 'まだ傾向を出すための記録がありません。数本分のテイスティングを追加すると、タイプ・産地・価格満足度が見えてきます。';
    }

    const topType = topValue(notes.map((note) => note.wine_type).filter(Boolean) as string[]);
    const topCountry = topValue(notes.map((note) => note.country).filter(Boolean) as string[]);
    const rated = notes.filter((note) => typeof note.rating === 'number');
    const highRated = [...rated].sort((a, b) => (b.rating || 0) - (a.rating || 0))[0];
    const pricedRated = notes.filter((note) => typeof note.price === 'number' && typeof note.rating === 'number');
    const satisfaction = [...pricedRated].sort((a, b) => {
        const aScore = (a.rating || 0) / Math.log10((a.price || 0) + 10);
        const bScore = (b.rating || 0) / Math.log10((b.price || 0) + 10);
        return bScore - aScore;
    })[0];

    return [
        topType ? `最も多いタイプは「${topType.label}」で、日常の選択軸になっています。` : '',
        topCountry ? `産地では「${topCountry.label}」の比重が高めです。` : '',
        highRated?.main_variety ? `高評価の品種では「${highRated.main_variety}」が目立ちます。` : '',
        satisfaction?.price ? `価格満足度は「¥${satisfaction.price.toLocaleString()}前後」の記録から手がかりが出ています。` : '',
    ].filter(Boolean).join(' ');
}

function topValue(values: string[]) {
    if (values.length === 0) return null;
    const counts = values.reduce((acc, value) => {
        acc[value] = (acc[value] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const [label, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return { label, count };
}

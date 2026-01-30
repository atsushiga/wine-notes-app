
'use client';

import React, { useMemo } from 'react';
import { ContentContainer } from '@/components/layout/ContentContainer';
import { PageHeader } from '@/components/layout/PageHeader';
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

    return (
        <ContentContainer size="wide" className="py-8">
            <PageHeader
                title="統計ダッシュボード"
                subtitle="データの可視化と分析"
            />

            <KPICards totalWines={totalWines} recentWines={recentWines} startDate={startDate} />

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

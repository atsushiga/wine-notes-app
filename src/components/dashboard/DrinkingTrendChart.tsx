
'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/primitives';

interface TrendData {
    month: string;
    count: number;
}

interface Props {
    data: TrendData[];
}

const DrinkingTrendChart: React.FC<Props> = ({ data }) => {
    const hasData = data.some((item) => item.count > 0);

    return (
        <Card className="p-6 h-[300px]">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">月別テイスティング推移</h3>
            {!hasData ? (
                <EmptyState
                    title="推移データがありません"
                    description="日付付きの記録が増えると、月別のテイスティング本数を確認できます。"
                    className="flex h-[220px] flex-col items-center justify-center"
                />
            ) : (
            <div className="h-[220px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" opacity={0.5} />
                        <XAxis
                            dataKey="month"
                            tick={{ fontSize: 10, fill: 'var(--chart-text)' }}
                            padding={{ left: 10, right: 10 }}
                        />
                        <YAxis tick={{ fontSize: 10, fill: 'var(--chart-text)' }} allowDecimals={false} />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'var(--card-bg)', borderRadius: '8px', border: '1px solid var(--border)', color: 'var(--text)' }}
                        />
                        <Line
                            type="monotone"
                            dataKey="count"
                            stroke="#E0184D"
                            strokeWidth={2}
                            dot={{ r: 4, fill: '#E0184D', strokeWidth: 0 }}
                            activeDot={{ r: 6 }}
                            animationDuration={1500}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            )}
        </Card>
    );
};

export default DrinkingTrendChart;

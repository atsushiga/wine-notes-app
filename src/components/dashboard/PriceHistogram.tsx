
'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/primitives';

interface PriceBin {
    range: string;
    min: number;
    count: number;
}

interface Props {
    data: PriceBin[];
}

const PriceHistogram: React.FC<Props> = ({ data }) => {
    const hasData = data.some((item) => item.count > 0);

    return (
        <Card className="p-6 h-full min-h-[474px]">
            <h3 className="mb-2 flex-none text-sm font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">価格帯分布</h3>
            {!hasData ? (
                <EmptyState
                    title="価格データがありません"
                    description="価格を入力した記録が増えると、購入価格帯の偏りを確認できます。"
                    className="flex h-[390px] flex-col items-center justify-center"
                />
            ) : (
            <div className="h-[390px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={data} margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--chart-grid)" opacity={0.5} />
                        <XAxis
                            type="number"
                            tick={{ fontSize: 10, fill: 'var(--chart-text)' }}
                            allowDecimals={false}
                        />
                        <YAxis
                            dataKey="range"
                            type="category"
                            tick={{ fontSize: 10, fill: 'var(--chart-text)' }}
                            width={70}
                            interval={0}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)', borderRadius: '8px', border: '1px solid var(--border)' }}
                            cursor={{ fill: 'var(--surface-2)', opacity: 0.5 }}
                        />
                        <Bar dataKey="count" fill="#C7A15A" name="本数" radius={[0, 4, 4, 0]} animationDuration={1000} label={{ position: 'right', fill: 'var(--text-muted)', fontSize: 10 }} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            )}
        </Card>
    );
};

export default PriceHistogram;

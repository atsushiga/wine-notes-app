
'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/Card';

interface TrendData {
    month: string;
    count: number;
}

interface Props {
    data: TrendData[];
}

const DrinkingTrendChart: React.FC<Props> = ({ data }) => {
    return (
        <Card className="p-6 h-[300px]">
            <h3 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wider mb-4">飲酒トレンド (月別)</h3>
            <div className="w-full h-[220px]">
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
                            stroke="#10b981"
                            strokeWidth={2}
                            dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }}
                            activeDot={{ r: 6 }}
                            animationDuration={1500}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
};

export default DrinkingTrendChart;

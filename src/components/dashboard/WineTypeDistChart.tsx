
'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { Card } from '@/components/ui/Card';

interface WineTypeStats {
    name: string;
    value: number;
    percent: number;
}

interface Props {
    data: WineTypeStats[];
}

const COLORS: Record<string, string> = {
    '赤': '#722f37', // Merlot / Wine Red
    '白': '#eccc68', // Straw / Gold
    'ロゼ': '#ff7f50', // Coral / Salmon
    'スパークリング': '#a4b0be', // Silver / Grey
    'オレンジ': '#ffa502', // Orange
    'その他': '#ced6e0' // Light Grey
};

const DEFAULT_COLOR = '#ced6e0';

const WineTypeDistChart: React.FC<Props> = ({ data }) => {
    // Transform data for a single stacked bar
    // content: { '赤': 10, '白': 5, ... }
    const chartData = [
        data.reduce((acc, curr) => ({ ...acc, [curr.name]: curr.value }), { name: 'Total' })
    ];

    const types = data.map(d => d.name);

    return (
        <Card className="p-6 h-[150px]">
            <h3 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">ワインタイプ比率</h3>
            <div className="w-full h-[80px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={chartData}>
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="name" hide />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'var(--card-bg)',
                                borderRadius: '8px',
                                border: '1px solid var(--border)',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                color: 'var(--text)'
                            }}
                            cursor={{ fill: 'transparent' }}
                        />
                        {types.map((type) => (
                            <Bar
                                key={type}
                                dataKey={type}
                                stackId="a"
                                fill={COLORS[type] || DEFAULT_COLOR}
                                radius={0}
                                animationDuration={1500}
                                label={{ position: 'center', fill: '#fff', fontSize: 10, formatter: (value: any) => value > 0 ? value : '' }}
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
};

export default WineTypeDistChart;

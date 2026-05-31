
'use client';

import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
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
    const total = data.reduce((sum, item) => sum + item.value, 0);

    return (
        <Card className="p-6 min-h-[260px]">
            <h3 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wider mb-3">ワインタイプ比率</h3>
            {data.length === 0 ? (
                <div className="h-[180px] flex items-center justify-center text-sm text-[var(--text-muted)]">
                    データがありません
                </div>
            ) : (
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="w-full sm:flex-1 h-[170px] min-w-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                                <Pie
                                    data={data}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius="45%"
                                    outerRadius="78%"
                                    paddingAngle={2}
                                    stroke="var(--card-bg)"
                                    strokeWidth={2}
                                    animationDuration={1200}
                                >
                                    {data.map((entry) => (
                                        <Cell key={entry.name} fill={COLORS[entry.name] || DEFAULT_COLOR} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: unknown, name: unknown) => {
                                        const numericValue = typeof value === 'number' ? value : Number(value);
                                        const percent = total > 0 && Number.isFinite(numericValue)
                                            ? (numericValue / total) * 100
                                            : 0;
                                        return [`${numericValue}本 (${percent.toFixed(1)}%)`, String(name)];
                                    }}
                                    contentStyle={{
                                        backgroundColor: 'var(--card-bg)',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border)',
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                        color: 'var(--text)'
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:block sm:min-w-[130px] sm:space-y-2">
                        {data.map((item) => (
                            <div key={item.name} className="flex items-center justify-between gap-3 text-xs">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span
                                        className="w-2.5 h-2.5 rounded-full flex-none"
                                        style={{ backgroundColor: COLORS[item.name] || DEFAULT_COLOR }}
                                    />
                                    <span className="text-[var(--text)] truncate">{item.name}</span>
                                </div>
                                <span className="text-[var(--text-muted)] tabular-nums flex-none">
                                    {item.percent.toFixed(0)}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </Card>
    );
};

export default WineTypeDistChart;

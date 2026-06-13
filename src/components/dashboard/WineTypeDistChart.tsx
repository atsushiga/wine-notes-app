
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
    '赤': 'var(--color-wine-red)',
    '白': 'var(--color-gold)',
    'ロゼ': 'var(--text-soft)',
    'スパークリング': 'var(--text-muted)',
    'オレンジ': '#D7A84F',
    'その他': 'var(--border)'
};

const DEFAULT_COLOR = 'var(--border)';

function WineTypeTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: WineTypeStats }> }) {
    if (!active || !payload?.length || !payload[0].payload) return null;

    const item = payload[0].payload;

    return (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2 text-xs text-[var(--text)] shadow-lg">
            <div className="flex items-center gap-2 font-semibold">
                <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: COLORS[item.name] || DEFAULT_COLOR }}
                    aria-hidden="true"
                />
                <span>{item.name}</span>
            </div>
            <div className="mt-1 text-[var(--text-muted)]">
                {item.value}本 ({item.percent.toFixed(1)}%)
            </div>
        </div>
    );
}

const WineTypeDistChart: React.FC<Props> = ({ data }) => {
    return (
        <Card className="p-6 min-h-[260px]">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">タイプ別の偏り</h3>
            {data.length === 0 ? (
                <div className="h-[180px] flex items-center justify-center text-sm text-[var(--text-muted)]">
                    データがありません
                </div>
            ) : (
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="h-[170px] w-full min-w-0 sm:flex-1">
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
                                <Tooltip content={<WineTypeTooltip />} />
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

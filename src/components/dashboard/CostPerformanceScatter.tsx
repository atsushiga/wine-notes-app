
'use client';

import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Label } from 'recharts';
import { Card } from '@/components/ui/Card';
import { TastingNote } from '@/types/custom';

interface Props {
    notes: TastingNote[];
}

const CostPerformanceScatter: React.FC<Props> = ({ notes }) => {
    // Filter data for scatter plot
    const data = notes
        .filter(n => n.price != null && n.rating != null)
        .map(n => ({
            x: n.price,
            y: n.rating,
            name: n.wine_name,
            vintage: n.vintage,
            id: n.id
        }));

    return (
        <Card className="p-6 h-[300px]">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">価格満足度 (価格 vs 評価)</h3>
            <div className="h-[220px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} stroke="var(--chart-grid)" />
                        <XAxis type="number" dataKey="x" name="価格" unit="円" tick={{ fontSize: 10, fill: 'var(--chart-text)' }}>
                            <Label value="価格 (円)" offset={0} position="bottom" style={{ fontSize: '10px', fill: 'var(--chart-text)' }} />
                        </XAxis>
                        <YAxis
                            type="number"
                            dataKey="y"
                            name="評価"
                            domain={[0, 10]}
                            ticks={[0, 2, 4, 6, 8, 10]}
                            allowDecimals={false}
                            tick={{ fontSize: 10, fill: 'var(--chart-text)' }}
                        >
                            <Label value="評価 (星)" angle={-90} position="left" style={{ fontSize: '10px', fill: 'var(--chart-text)' }} />
                        </YAxis>
                        <Tooltip
                            cursor={{ strokeDasharray: '3 3' }}
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const d = payload[0].payload;
                                    return (
                                        <div className="bg-[var(--card-bg)] border border-[var(--border)] p-3 rounded shadow-lg text-xs text-[var(--text)]">
                                            <p className="font-bold mb-1">{d.name} {d.vintage ? `(${d.vintage})` : ''}</p>
                                            <p>価格: {d.x.toLocaleString()}円</p>
                                            <p>評価: {d.y} stars</p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Scatter name="Wines" data={data} fill="#E0184D" fillOpacity={0.72} />
                    </ScatterChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
};

export default CostPerformanceScatter;

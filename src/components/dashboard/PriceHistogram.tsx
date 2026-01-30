
'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/Card';

interface PriceBin {
    range: string;
    min: number;
    count: number;
}

interface Props {
    data: PriceBin[];
}

const PriceHistogram: React.FC<Props> = ({ data }) => {
    return (
        <Card className="p-6 h-full min-h-[474px] flex flex-col">
            <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-2 flex-none">価格帯分布</h3>
            <div className="w-full flex-grow min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={data} margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" opacity={0.5} />
                        <XAxis
                            type="number"
                            tick={{ fontSize: 10, fill: '#6b7280' }}
                            allowDecimals={false}
                        />
                        <YAxis
                            dataKey="range"
                            type="category"
                            tick={{ fontSize: 10, fill: '#6b7280' }}
                            width={70}
                            interval={0}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'var(--bg-popup)', color: 'var(--fg)', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                            cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                        />
                        <Bar dataKey="count" fill="#8884d8" name="本数" radius={[0, 4, 4, 0]} animationDuration={1000} label={{ position: 'right', fill: '#666', fontSize: 10 }} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
};

export default PriceHistogram;

'use client';

import React from 'react';
import { scaleQuantile } from 'd3-scale';
import { Card } from '@/components/ui/Card';

interface RegionData {
    name: string;
    value: number;
}

interface Props {
    data: RegionData[];
}

const NAME_MAPPING: Record<string, string> = {
    'フランス': 'France',
    'イタリア': 'Italy',
    'アメリカ': 'United States of America',
    'スペイン': 'Spain',
    'チリ': 'Chile',
    'オーストラリア': 'Australia',
    'ドイツ': 'Germany',
    'アルゼンチン': 'Argentina',
    '南アフリカ': 'South Africa',
    'ニュージーランド': 'New Zealand',
    'ポルトガル': 'Portugal',
    '日本': 'Japan',
    'USA': 'United States of America',
    'California': 'United States of America', // Common mistake
};

const FLAG_MAPPING: Record<string, string> = {
    'France': '🇫🇷',
    'Italy': '🇮🇹',
    'United States of America': '🇺🇸',
    'Spain': '🇪🇸',
    'Chile': '🇨🇱',
    'Australia': '🇦🇺',
    'Germany': '🇩🇪',
    'Argentina': '🇦🇷',
    'South Africa': '🇿🇦',
    'New Zealand': '🇳🇿',
    'Portugal': '🇵🇹',
    'Japan': '🇯🇵',
    'China': '🇨🇳',
    'Austria': '🇦🇹',
    'Hungary': '🇭🇺',
    'Canada': '🇨🇦',
    'Greece': '🇬🇷',
    'Romania': '🇷🇴',
    'Uruguay': '🇺🇾',
};

const getFlag = (countryName: string) => FLAG_MAPPING[countryName] || '🏳️';

const RegionMap: React.FC<Props> = ({ data }) => {
    const mappedData = data.reduce((acc, curr) => {
        const engName = NAME_MAPPING[curr.name] || curr.name;
        acc[engName] = (acc[engName] || 0) + curr.value;
        return acc;
    }, {} as Record<string, number>);
    const entries = Object.entries(mappedData)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    const maxValue = Math.max(...entries.map((entry) => entry.value), 1);

    const colorScale = scaleQuantile<string>()
        .domain(Object.values(mappedData))
        .range([
            "#ffedea",
            "#ffcec5",
            "#ffad9f",
            "#ff8a75",
            "#cf597e", // Wine-ish
            "#9e2a2b", // Deep red
            "#540b0e"  // Very dark
        ]);

    return (
        <Card className="p-4 sm:p-6 relative">
            <h3 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wider mb-4">産地分布</h3>
            <div className="min-h-[clamp(220px,45vw,420px)] rounded border border-[var(--border)] bg-[var(--surface-2)] p-4">
                {entries.length === 0 ? (
                    <div className="flex h-48 items-center justify-center text-sm text-[var(--text-muted)]">
                        産地データがありません
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {entries.map((entry) => {
                            const width = `${Math.max(8, Math.round((entry.value / maxValue) * 100))}%`;
                            const color = colorScale(entry.value);
                            return (
                                <div key={entry.name} className="rounded-md border border-[var(--border)] bg-[var(--card-bg)] p-3">
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <span className="text-lg" aria-hidden="true">{getFlag(entry.name)}</span>
                                            <span className="truncate text-sm font-semibold text-[var(--text)]">{entry.name}</span>
                                        </div>
                                        <span className="shrink-0 text-sm font-bold text-[var(--text)]">{entry.value}本</span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                                        <div className="h-full rounded-full" style={{ width, backgroundColor: color }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="mt-3 bg-[var(--card-bg)]/90 p-3 rounded-lg shadow-sm border border-[var(--border)] text-xs backdrop-blur-sm">
                <div className="font-semibold mb-2 text-[var(--text-muted)]">本数</div>
                <div className="flex flex-wrap sm:flex-col gap-x-4 gap-y-2 sm:gap-x-0 sm:gap-y-0 sm:space-y-2">
                    <div className="flex items-center">
                        <div className="w-3 h-3 mr-2 bg-[var(--surface-2)] rounded-sm border border-[var(--border)]"></div>
                        <span className="text-[var(--text-muted)]">0本</span>
                    </div>
                    <div className="flex items-center">
                        <div className="w-3 h-3 mr-2 rounded-sm" style={{ backgroundColor: "#ffad9f" }}></div>
                        <span className="text-[var(--text-muted)]">1-3本</span>
                    </div>
                    <div className="flex items-center">
                        <div className="w-3 h-3 mr-2 rounded-sm" style={{ backgroundColor: "#9e2a2b" }}></div>
                        <span className="text-[var(--text-muted)]">4本以上</span>
                    </div>
                </div>
            </div>
            <p className="text-xs text-right text-[var(--text-muted)] mt-2">※ 日本語の国名は集計用に自動変換しています</p>
        </Card>
    );
};

export default RegionMap;

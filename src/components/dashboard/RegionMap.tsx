'use client';

import React from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { scaleQuantile } from 'd3-scale';
import { feature } from 'topojson-client';
import type { FeatureCollection, Geometry } from 'geojson';
import type { GeometryCollection, GeometryObject, Topology } from 'topojson-specification';
import { Card } from '@/components/ui/Card';
import worldCountries from '@/data/world-countries-110m.json';

interface RegionData {
    name: string;
    value: number;
}

interface Props {
    data: RegionData[];
}

type CountryProperties = {
    name?: string;
};

type WorldTopology = Topology<{
    countries: GeometryCollection<CountryProperties>;
    land: GeometryObject<CountryProperties>;
}>;

const MAP_WIDTH = 800;
const MAP_HEIGHT = 420;
const topology = worldCountries as unknown as WorldTopology;
const countries = feature<CountryProperties>(
    topology,
    topology.objects.countries,
) as FeatureCollection<Geometry, CountryProperties>;
const projection = geoNaturalEarth1()
    .scale(145)
    .translate([MAP_WIDTH / 2, MAP_HEIGHT / 2]);
const pathGenerator = geoPath(projection);

const NAME_MAPPING: Record<string, string> = {
    'フランス': 'France',
    'イタリア': 'Italy',
    'アメリカ': 'United States of America',
    'アメリカ合衆国': 'United States of America',
    '米国': 'United States of America',
    'スペイン': 'Spain',
    'チリ': 'Chile',
    'オーストラリア': 'Australia',
    'ドイツ': 'Germany',
    'アルゼンチン': 'Argentina',
    '南アフリカ': 'South Africa',
    'ニュージーランド': 'New Zealand',
    'ポルトガル': 'Portugal',
    '日本': 'Japan',
    'オーストリア': 'Austria',
    'ハンガリー': 'Hungary',
    'カナダ': 'Canada',
    'ギリシャ': 'Greece',
    'ルーマニア': 'Romania',
    'ウルグアイ': 'Uruguay',
    'ジョージア': 'Georgia',
    'モルドバ': 'Moldova',
    'クロアチア': 'Croatia',
    'スロベニア': 'Slovenia',
    'スイス': 'Switzerland',
    '中国': 'China',
    '英国': 'United Kingdom',
    'イギリス': 'United Kingdom',
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
    'Georgia': '🇬🇪',
    'Moldova': '🇲🇩',
    'Croatia': '🇭🇷',
    'Slovenia': '🇸🇮',
    'Switzerland': '🇨🇭',
    'United Kingdom': '🇬🇧',
};

const getFlag = (countryName: string) => FLAG_MAPPING[countryName] || '🏳️';

const RegionMap: React.FC<Props> = ({ data }) => {
    const [activeCountry, setActiveCountry] = React.useState<{ name: string; value: number } | null>(null);
    const activateCountry = (name: string, value: number) => {
        setActiveCountry(value ? { name, value } : null);
    };

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
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wider">産地マップ</h3>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">記録したワインの国別本数を世界地図上で表示します。</p>
                </div>
                {activeCountry && (
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2 text-xs shadow-sm">
                        <div className="flex items-center gap-2 font-semibold text-[var(--text)]">
                            <span aria-hidden="true">{getFlag(activeCountry.name)}</span>
                            <span>{activeCountry.name}</span>
                        </div>
                        <div className="mt-1 text-[var(--text-muted)]">{activeCountry.value}本</div>
                    </div>
                )}
            </div>

            <div className="overflow-hidden rounded border border-[var(--border)] bg-[var(--surface-2)]">
                {entries.length === 0 ? (
                    <div className="flex h-48 items-center justify-center text-sm text-[var(--text-muted)]">
                        産地データがありません
                    </div>
                ) : (
                    <svg
                        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                        role="img"
                        aria-label="ワイン記録の国別分布を示す世界地図"
                        className="block h-auto w-full"
                    >
                        <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="var(--surface-2)" />
                        {countries.features.map((country, index) => {
                            const name = country.properties?.name || '';
                            const value = mappedData[name] || 0;
                            const isActive = activeCountry?.name === name;
                            const fill = value
                                ? isActive ? '#f97316' : colorScale(value)
                                : 'var(--card-bg)';
                            const stroke = isActive ? 'var(--text)' : 'var(--border)';

                            return (
                                <path
                                    key={`${name}-${index}`}
                                    d={pathGenerator(country) || undefined}
                                    fill={fill}
                                    stroke={stroke}
                                    strokeWidth={isActive ? 1.1 : 0.45}
                                    tabIndex={value ? 0 : -1}
                                    role={value ? 'button' : undefined}
                                    aria-label={value ? `${name}: ${value}本` : undefined}
                                    className={`transition-colors duration-150 focus:outline-none ${value ? 'cursor-pointer' : ''}`}
                                    onMouseEnter={() => activateCountry(name, value)}
                                    onMouseLeave={() => setActiveCountry(null)}
                                    onFocus={() => activateCountry(name, value)}
                                    onBlur={() => setActiveCountry(null)}
                                >
                                    <title>{`${name}: ${value}本`}</title>
                                </path>
                            );
                        })}
                    </svg>
                )}
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)]">
                <div className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)]/90 p-3 text-xs shadow-sm backdrop-blur-sm">
                    <div className="font-semibold mb-2 text-[var(--text-muted)]">本数</div>
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
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {entries.slice(0, 6).map((entry) => {
                        const width = `${Math.max(8, Math.round((entry.value / maxValue) * 100))}%`;
                        return (
                            <div
                                key={entry.name}
                                className="rounded-md border border-[var(--border)] bg-[var(--card-bg)] p-3"
                                onMouseEnter={() => setActiveCountry(entry)}
                                onMouseLeave={() => setActiveCountry(null)}
                            >
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <span className="text-lg" aria-hidden="true">{getFlag(entry.name)}</span>
                                        <span className="truncate text-sm font-semibold text-[var(--text)]">{entry.name}</span>
                                    </div>
                                    <span className="shrink-0 text-sm font-bold text-[var(--text)]">{entry.value}本</span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                                    <div className="h-full rounded-full" style={{ width, backgroundColor: colorScale(entry.value) }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            <p className="text-xs text-right text-[var(--text-muted)] mt-2">※ 地図データはローカルTopoJSONを使用し、日本語の国名は集計用に自動変換しています</p>
        </Card>
    );
};

export default RegionMap;

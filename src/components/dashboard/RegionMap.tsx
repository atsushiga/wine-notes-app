'use client';

import React from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { scaleQuantile } from 'd3-scale';
import { Card } from '@/components/ui/Card';

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

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
    const [tooltip, setTooltip] = React.useState<{ x: number; y: number; content: React.ReactNode; visible: boolean }>({
        x: 0,
        y: 0,
        content: null,
        visible: false,
    });

    // Translate data to English names for matching
    const mappedData = data.reduce((acc, curr) => {
        const engName = NAME_MAPPING[curr.name] || curr.name;
        acc[engName] = (acc[engName] || 0) + curr.value;
        return acc;
    }, {} as Record<string, number>);

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
            <h3 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wider mb-4">産地マップ</h3>
            <div
                className="w-full h-[clamp(220px,45vw,420px)] bg-[var(--surface-2)] rounded border border-[var(--border)] overflow-hidden relative"
                onMouseMove={(e) => {
                    if (tooltip.visible) {
                        setTooltip(prev => ({ ...prev, x: e.clientX, y: e.clientY }));
                    }
                }}
            >
                <ComposableMap
                    projection="geoNaturalEarth1"
                    projectionConfig={{ scale: 145, center: [0, 0] }}
                    width={800}
                    height={420}
                    style={{ width: '100%', height: '100%' }}
                >
                    <Geographies geography={GEO_URL}>
                        {({ geographies }) =>
                            geographies.map((geo) => {
                                const cur = mappedData[geo.properties.name];
                                const flag = getFlag(geo.properties.name);
                                return (
                                    <Geography
                                        key={geo.rsmKey}
                                        geography={geo}
                                        fill={cur ? colorScale(cur) : "var(--card-bg)"}
                                        stroke="var(--border)"
                                        strokeWidth={0.5}
                                        style={{
                                            default: { outline: "none" },
                                            hover: { fill: "#F53", outline: "none", cursor: 'pointer' },
                                            pressed: { outline: "none" },
                                        }}
                                        onMouseEnter={(e) => {
                                            const content = (
                                                <div className="flex flex-col items-center">
                                                    <span className="text-lg mb-1">{flag}</span>
                                                    <span className="font-bold">{geo.properties.name}</span>
                                                    <span>{cur || 0}本</span>
                                                </div>
                                            );
                                            setTooltip({
                                                x: e.clientX,
                                                y: e.clientY,
                                                content,
                                                visible: true
                                            });
                                        }}
                                        onMouseLeave={() => {
                                            setTooltip(prev => ({ ...prev, visible: false }));
                                        }}
                                    />
                                );
                            })
                        }
                    </Geographies>
                </ComposableMap>

                {/* Tooltip Overlay */}
                {tooltip.visible && (
                    <div
                        className="fixed z-[9999] bg-[var(--chip-bg)] border border-[var(--chip-border)] text-[var(--chip-text)] text-xs p-3 rounded-lg pointer-events-none transform -translate-x-1/2 -translate-y-full mt-[-10px] shadow-xl backdrop-blur-sm"
                        style={{ left: tooltip.x, top: tooltip.y }}
                    >
                        {tooltip.content}
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="mt-3 sm:mt-0 sm:absolute sm:top-20 sm:right-8 bg-[var(--card-bg)]/90 p-3 rounded-lg shadow-sm border border-[var(--border)] text-xs backdrop-blur-sm">
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
            <p className="text-xs text-right text-[var(--text-muted)] mt-2">※ 日本語の国名は自動変換してマッピングしています</p>
        </Card>
    );
};

export default RegionMap;

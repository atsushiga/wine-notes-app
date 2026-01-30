'use client';

import React from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
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
        <Card className="p-6 h-[500px] relative">
            <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">産地マップ</h3>
            <div
                className="w-full h-[420px] bg-zinc-50 rounded border border-zinc-100 overflow-hidden relative cursor-move"
                onMouseMove={(e) => {
                    // Update tooltip position if visible
                    if (tooltip.visible) {
                        // Calculate relative position to the container if needed, 
                        // but sticking to clientX/Y for fixed overlay is usually easier.
                        // However, we need to subtract the container's offset if we render absolute.
                        // Let's use fixed positioning for the tooltip to avoid overflow issues.
                        setTooltip(prev => ({ ...prev, x: e.clientX, y: e.clientY }));
                    }
                }}
            >
                <ComposableMap projection="geoMercator">
                    <ZoomableGroup center={[0, 20]} zoom={0.8}>
                        <Geographies geography={GEO_URL}>
                            {({ geographies }) =>
                                geographies.map((geo) => {
                                    const cur = mappedData[geo.properties.name];
                                    const flag = getFlag(geo.properties.name);
                                    return (
                                        <Geography
                                            key={geo.rsmKey}
                                            geography={geo}
                                            fill={cur ? colorScale(cur) : "#EEE"}
                                            stroke="#D6D6DA"
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
                    </ZoomableGroup>
                </ComposableMap>

                {/* Tooltip Overlay */}
                {tooltip.visible && (
                    <div
                        className="fixed z-[9999] bg-zinc-900/90 text-white text-xs p-3 rounded-lg pointer-events-none transform -translate-x-1/2 -translate-y-full mt-[-10px] shadow-xl backdrop-blur-sm"
                        style={{ left: tooltip.x, top: tooltip.y }}
                    >
                        {tooltip.content}
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="absolute top-20 right-8 bg-white/90 p-3 rounded-lg shadow-sm border border-zinc-100 text-xs backdrop-blur-sm">
                <div className="font-semibold mb-2 text-zinc-600">本数</div>
                <div className="flex flex-col space-y-2">
                    <div className="flex items-center">
                        <div className="w-3 h-3 mr-2 bg-gray-200 rounded-sm"></div>
                        <span className="text-zinc-500">0本</span>
                    </div>
                    <div className="flex items-center">
                        <div className="w-3 h-3 mr-2 rounded-sm" style={{ backgroundColor: "#ffad9f" }}></div>
                        <span className="text-zinc-500">1-3本</span>
                    </div>
                    <div className="flex items-center">
                        <div className="w-3 h-3 mr-2 rounded-sm" style={{ backgroundColor: "#9e2a2b" }}></div>
                        <span className="text-zinc-500">4本以上</span>
                    </div>
                </div>
            </div>
            <p className="text-xs text-right text-zinc-400 mt-2">※ 日本語の国名は自動変換してマッピングしています</p>
        </Card>
    );
};

export default RegionMap;

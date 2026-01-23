import React, { useState, useMemo } from 'react';
import { SAT_AROMA_DEFINITIONS } from '@/constants/sat_aromas';
import { Search, ChevronDown, ChevronRight, Check, X } from 'lucide-react';

interface AromaSelectorProps {
    selectedAromas: string[];
    onChange: (aromas: string[]) => void;
}

export default function AromaSelector({ selectedAromas = [], onChange }: AromaSelectorProps) {
    const [activeLayerIndex, setActiveLayerIndex] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

    const toggleAroma = (term: string) => {
        if (selectedAromas.includes(term)) {
            onChange(selectedAromas.filter(a => a !== term));
        } else {
            onChange([...selectedAromas, term]);
        }
    };

    const toggleCategory = (categoryName: string) => {
        setExpandedCategories(prev => ({
            ...prev,
            [categoryName]: !prev[categoryName]
        }));
    };

    const filteredDefinitions = useMemo(() => {
        if (!searchQuery) return SAT_AROMA_DEFINITIONS;

        return SAT_AROMA_DEFINITIONS.map(layer => ({
            ...layer,
            categories: layer.categories.map(cat => ({
                ...cat,
                terms: cat.terms.filter(term =>
                    term.toLowerCase().includes(searchQuery.toLowerCase())
                )
            })).filter(cat => cat.terms.length > 0)
        })).filter(layer => layer.categories.length > 0);
    }, [searchQuery]);

    const activeLayer = filteredDefinitions[activeLayerIndex];

    // Search Mode: Show flattened list or keep hierarchy?
    // Hierarchy seems better to correct context.
    const isSearching = searchQuery.length > 0;

    return (
        <div className="space-y-4 border rounded-lg p-4 bg-white">
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900">アロマ (SAT)</h3>
                    <span className="text-sm text-gray-500">{selectedAromas.length} mask selected</span>
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="アロマを検索..."
                        className="w-full pl-9 pr-4 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Display Selected Tags (Cross-layer) */}
                {selectedAromas.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-md border border-gray-100">
                        {selectedAromas.map(term => (
                            <button
                                key={term}
                                type="button"
                                onClick={() => toggleAroma(term)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200"
                            >
                                {term}
                                <X className="w-3 h-3" />
                            </button>
                        ))}
                    </div>
                )}

                {/* Layer Tabs */}
                {!isSearching && (
                    <div className="flex border-b overflow-x-auto">
                        {SAT_AROMA_DEFINITIONS.map((layer, idx) => (
                            <button
                                key={layer.layer}
                                type="button"
                                onClick={() => setActiveLayerIndex(idx)}
                                className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeLayerIndex === idx
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                {layer.layer.split(' ')[0]} {/* Show "第一アロマ" etc */}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div className="min-h-[300px] max-h-[500px] overflow-y-auto pr-2">
                {isSearching ? (
                    <div className="space-y-6">
                        {filteredDefinitions.map((layer) => (
                            <div key={layer.layer}>
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                    {layer.layer}
                                </h4>
                                <div className="space-y-4 pl-2 border-l-2 border-gray-100">
                                    {layer.categories.map((category) => (
                                        <div key={category.name}>
                                            <div className="text-sm font-medium text-gray-700 mb-2">
                                                {category.name}
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {category.terms.map((term) => {
                                                    const isSelected = selectedAromas.includes(term);
                                                    return (
                                                        <button
                                                            key={term}
                                                            type="button"
                                                            onClick={() => toggleAroma(term)}
                                                            className={`
                                                                px-3 py-1.5 rounded-full text-sm transition-all border
                                                                ${isSelected
                                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                                                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
                                                            `}
                                                        >
                                                            {term}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {filteredDefinitions.length === 0 && (
                            <div className="text-center py-8 text-gray-500">
                                該当するアロマが見つかりません
                            </div>
                        )}
                    </div>
                ) : (
                    // Regular Tab View
                    <div className="space-y-6">
                        <div className="text-sm text-gray-500 bg-blue-50 p-2 rounded">
                            {SAT_AROMA_DEFINITIONS[activeLayerIndex].description}
                        </div>

                        {SAT_AROMA_DEFINITIONS[activeLayerIndex].categories.map((category) => {
                            // Default all open or toggle? "Reviewer asked for filtering OR open/close feature"
                            // Let's make them open by default for visibility, but collapsible.
                            const isExpanded = expandedCategories[category.name] ?? true; // Default Open

                            return (
                                <div key={category.name} className="border rounded-md overflow-hidden">
                                    <button
                                        onClick={() => toggleCategory(category.name)}
                                        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                                        type="button"
                                    >
                                        <span className="font-medium text-gray-800">{category.name}</span>
                                        {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                                    </button>

                                    {isExpanded && (
                                        <div className="p-3 bg-white flex flex-wrap gap-2">
                                            {category.terms.map((term) => {
                                                const isSelected = selectedAromas.includes(term);
                                                return (
                                                    <button
                                                        key={term}
                                                        onClick={() => toggleAroma(term)}
                                                        type="button"
                                                        className={`
                                                            group relative px-3 py-1.5 rounded-full text-sm transition-all border
                                                            ${isSelected
                                                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm pl-8'
                                                                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
                                                        `}
                                                    >
                                                        {isSelected && (
                                                            <Check className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                                        )}
                                                        {term}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

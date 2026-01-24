import React, { useState, useMemo, useEffect } from 'react';
import { SAT_AROMA_DEFINITIONS } from '@/constants/sat_aromas';
import { Search, ChevronDown, ChevronRight, Check, X, History, Trophy, BookOpen } from 'lucide-react';
import { useAromaHistory } from '@/hooks/useAromaHistory';

interface AromaSelectorProps {
    selectedAromas: string[];
    onChange: (aromas: string[]) => void;
}

export default function AromaSelector({ selectedAromas = [], onChange }: AromaSelectorProps) {
    const [activeLayerIndex, setActiveLayerIndex] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
    // Start with False (collapsed)
    const [isBrowseOpen, setIsBrowseOpen] = useState(false);
    // Track "Show more" state for each category
    const [showAllCategoryItems, setShowAllCategoryItems] = useState<Record<string, boolean>>({});

    const { recents, frequents, addHistory } = useAromaHistory();

    const toggleAroma = (term: string) => {
        if (selectedAromas.includes(term)) {
            onChange(selectedAromas.filter(a => a !== term));
        } else {
            onChange([...selectedAromas, term]);
            addHistory(term);
        }
    };

    const toggleCategory = (categoryName: string) => {
        setExpandedCategories(prev => ({
            ...prev,
            [categoryName]: !prev[categoryName]
        }));
    };

    const toggleShowAll = (categoryName: string) => {
        setShowAllCategoryItems(prev => ({
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

    // Group selected aromas for the "Shelf" view
    const groupedSelected = useMemo(() => {
        const groups: Record<string, string[]> = {
            'Primary': [],
            'Secondary': [],
            'Tertiary': [],
            'Other': []
        };

        selectedAromas.forEach(term => {
            let found = false;
            for (const layer of SAT_AROMA_DEFINITIONS) {
                // Check if term exists in this layer
                const isMatch = layer.categories.some(cat => cat.terms.includes(term));
                if (isMatch) {
                    if (layer.layer.includes('Primary')) groups['Primary'].push(term);
                    else if (layer.layer.includes('Secondary')) groups['Secondary'].push(term);
                    else if (layer.layer.includes('Tertiary')) groups['Tertiary'].push(term);
                    else groups['Other'].push(term); // Fallback
                    found = true;
                    break;
                }
            }
            if (!found) groups['Other'].push(term);
        });
        return groups;
    }, [selectedAromas]);

    const activeLayer = filteredDefinitions[activeLayerIndex];
    const isSearching = searchQuery.length > 0;

    return (
        <div className="space-y-4 border rounded-lg p-4 bg-white shadow-sm border-zinc-100">
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900">アロマ (SAT)</h3>
                    <span className="text-sm text-gray-500">{selectedAromas.length} items</span>
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="アロマを検索..."
                        className="w-full pl-9 pr-4 py-2 text-sm border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 bg-gray-50 focus:bg-white transition-colors"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            if (e.target.value) setIsBrowseOpen(true); // Search implies browsing
                        }}
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

                {/* QuickPick: Recent & Frequent (Only show if not searching) */}
                {!isSearching && (
                    <div className="space-y-3">
                        {/* Recent */}
                        {recents.length > 0 && (
                            <div className="flex items-center gap-2 overflow-hidden">
                                <div className="flex-shrink-0 w-6 flex justify-center text-gray-300" title="Recent">
                                    <History size={14} />
                                </div>
                                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide no-scrollbar mask-gradient-right">
                                    {recents.map(term => (
                                        <button
                                            key={`recent-${term}`}
                                            type="button"
                                            onClick={() => toggleAroma(term)}
                                            className={`
                                                flex-shrink-0 px-2.5 py-1 rounded-full text-xs border transition-colors whitespace-nowrap
                                                ${selectedAromas.includes(term)
                                                    ? 'bg-blue-50 text-blue-700 border-blue-100'
                                                    : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50 hover:text-gray-700'}
                                            `}
                                        >
                                            {term}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Frequent */}
                        {frequents.length > 0 && (
                            <div className="flex items-center gap-2 overflow-hidden">
                                <div className="flex-shrink-0 w-6 flex justify-center text-amber-300" title="Frequent">
                                    <Trophy size={14} />
                                </div>
                                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide no-scrollbar mask-gradient-right">
                                    {frequents.map(term => (
                                        <button
                                            key={`freq-${term}`}
                                            type="button"
                                            onClick={() => toggleAroma(term)}
                                            className={`
                                                flex-shrink-0 px-2.5 py-1 rounded-full text-xs border transition-colors whitespace-nowrap
                                                ${selectedAromas.includes(term)
                                                    ? 'bg-amber-50 text-amber-700 border-amber-100'
                                                    : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50 hover:text-gray-700'}
                                            `}
                                        >
                                            {term}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}


                {/* Shelf: Visual Grouping of Selected Aromas (Toned Down) */}
                {selectedAromas.length > 0 && (
                    <div className="flex flex-col gap-3 p-3 bg-zinc-50/50 rounded-lg border border-zinc-100/50">
                        {/* Primary */}
                        {groupedSelected['Primary'].length > 0 && (
                            <div className="flex flex-col sm:flex-row sm:gap-4 sm:items-start gap-1">
                                <span className="text-[10px] uppercase tracking-wide text-zinc-400 w-16 flex-shrink-0 sm:mt-1.5 font-medium">Primary</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {groupedSelected['Primary'].map(term => (
                                        <MountedShelfChip key={term} term={term} onRemove={() => toggleAroma(term)} colorClass="bg-green-50 text-green-700 border-green-100" />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Secondary */}
                        {groupedSelected['Secondary'].length > 0 && (
                            <div className="flex flex-col sm:flex-row sm:gap-4 sm:items-start gap-1">
                                <span className="text-[10px] uppercase tracking-wide text-zinc-400 w-16 flex-shrink-0 sm:mt-1.5 font-medium">Secondary</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {groupedSelected['Secondary'].map(term => (
                                        <MountedShelfChip key={term} term={term} onRemove={() => toggleAroma(term)} colorClass="bg-orange-50 text-orange-700 border-orange-100" />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Tertiary */}
                        {groupedSelected['Tertiary'].length > 0 && (
                            <div className="flex flex-col sm:flex-row sm:gap-4 sm:items-start gap-1">
                                <span className="text-[10px] uppercase tracking-wide text-zinc-400 w-16 flex-shrink-0 sm:mt-1.5 font-medium">Tertiary</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {groupedSelected['Tertiary'].map(term => (
                                        <MountedShelfChip key={term} term={term} onRemove={() => toggleAroma(term)} colorClass="bg-amber-50 text-amber-800 border-amber-100" />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Other */}
                        {groupedSelected['Other'].length > 0 && (
                            <div className="flex flex-col sm:flex-row sm:gap-4 sm:items-start gap-1">
                                <span className="text-[10px] uppercase tracking-wide text-zinc-400 w-16 flex-shrink-0 sm:mt-1.5 font-medium">Other</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {groupedSelected['Other'].map(term => (
                                        <MountedShelfChip key={term} term={term} onRemove={() => toggleAroma(term)} colorClass="bg-gray-100 text-gray-600 border-gray-200" />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Collapsible Browse Section (Quiet) */}
            <div className={`mt-4 ${!isSearching ? 'border-t border-zinc-100 pt-4' : ''}`}>
                {!isSearching && (
                    <button
                        type="button"
                        onClick={() => setIsBrowseOpen(!isBrowseOpen)}
                        className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-800 transition-colors mb-2 group w-full"
                    >
                        {isBrowseOpen ? <ChevronDown size={14} className="text-zinc-400 group-hover:text-zinc-600" /> : <ChevronRight size={14} className="text-zinc-400 group-hover:text-zinc-600" />}
                        <span className={isBrowseOpen ? "font-medium" : "decoration-zinc-300 underline-offset-4 group-hover:underline"}>
                            Browse aromas by category
                        </span>
                    </button>
                )}

                {/* Browse Content */}
                {(isSearching || isBrowseOpen) && (
                    <div className="animate-in slide-in-from-top-2 fade-in duration-200">
                        {/* Layer Tabs */}
                        {!isSearching && (
                            <div className="flex border-b border-zinc-100 overflow-x-auto mb-4 scrollbar-hide">
                                {SAT_AROMA_DEFINITIONS.map((layer, idx) => (
                                    <button
                                        key={layer.layer}
                                        type="button"
                                        onClick={() => setActiveLayerIndex(idx)}
                                        className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeLayerIndex === idx
                                            ? 'border-blue-400 text-blue-600'
                                            : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'
                                            }`}
                                    >
                                        {layer.layer.split(' ')[0]}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Content Area */}
                        <div className="min-h-[200px] max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                            {isSearching ? (
                                <div className="space-y-6">
                                    {filteredDefinitions.map((layer) => (
                                        <div key={layer.layer}>
                                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                                {layer.layer}
                                            </h4>
                                            <div className="space-y-4 pl-2 border-l-2 border-gray-100">
                                                {layer.categories.map((category) => (
                                                    <div key={category.name}>
                                                        <div className="text-sm font-medium text-gray-700 mb-2">
                                                            {category.name}
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {category.terms.map((term) => (
                                                                <AromaChip
                                                                    key={term}
                                                                    term={term}
                                                                    selected={selectedAromas.includes(term)}
                                                                    onClick={() => toggleAroma(term)}
                                                                />
                                                            ))}
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
                                // Regular Tab View with "Show More" logic
                                <div className="space-y-4">
                                    <div className="text-xs text-gray-500 bg-zinc-50 p-2 rounded border border-zinc-100">
                                        {SAT_AROMA_DEFINITIONS[activeLayerIndex].description}
                                    </div>

                                    {SAT_AROMA_DEFINITIONS[activeLayerIndex].categories.map((category) => {
                                        const isExpanded = expandedCategories[category.name] ?? false;
                                        const showAll = showAllCategoryItems[category.name] ?? false;
                                        const displayTerms = showAll ? category.terms : category.terms.slice(0, 6);
                                        const hasMore = category.terms.length > 6;
                                        const hiddenCount = category.terms.length - 6;

                                        return (
                                            <div key={category.name} className="border border-zinc-100 rounded-lg overflow-hidden transition-all duration-200">
                                                <button
                                                    onClick={() => toggleCategory(category.name)}
                                                    className="w-full flex items-center justify-between p-3 bg-white hover:bg-gray-50 transition-colors text-left"
                                                    type="button"
                                                >
                                                    <span className="font-medium text-sm text-gray-700">{category.name}</span>
                                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                                </button>

                                                {isExpanded && (
                                                    <div className="p-3 pt-0 bg-white border-t border-zinc-50">
                                                        <div className="flex flex-wrap gap-2 pt-3">
                                                            {displayTerms.map((term) => (
                                                                <AromaChip
                                                                    key={term}
                                                                    term={term}
                                                                    selected={selectedAromas.includes(term)}
                                                                    onClick={() => toggleAroma(term)}
                                                                />
                                                            ))}
                                                            {hasMore && !showAll && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleShowAll(category.name)}
                                                                    className="text-xs text-blue-500 hover:text-blue-700 font-medium px-2 py-1"
                                                                >
                                                                    +{hiddenCount} more
                                                                </button>
                                                            )}
                                                            {hasMore && showAll && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleShowAll(category.name)}
                                                                    className="text-xs text-gray-400 hover:text-gray-600 font-medium px-2 py-1"
                                                                >
                                                                    Show less
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Sub-components

function AromaChip({ term, selected, onClick }: { term: string; selected: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`
                group relative px-3 py-1.5 rounded-full text-xs transition-all border
                ${selected
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm pl-7'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
            `}
        >
            {selected && (
                <Check className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2" />
            )}
            {term}
        </button>
    )
}

function MountedShelfChip({ term, onRemove, colorClass }: { term: string, onRemove: () => void, colorClass: string }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // Trigger animation next frame
        requestAnimationFrame(() => setMounted(true));
    }, []);

    return (
        <button
            type="button"
            onClick={onRemove}
            className={`
                inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-xs font-medium border
                transition-all duration-150 ease-out transform
                ${colorClass}
                ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
                hover:opacity-80
            `}
        >
            {term}
            <X className="w-3 h-3 opacity-40 hover:opacity-100" />
        </button>
    )
}

'use client';

import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { Loader2, MapPin } from 'lucide-react';

interface Suggestion {
    id: number;
    name: string;
    name_ja?: string;
    level: string;
    country: string;
    parent_hint?: string;
}

interface LocalityComboboxProps {
    value?: string;
    onChange: (value: string) => void;
    onSelectId?: (id: number | null) => void;
    countryJa?: string | null;
    disabled?: boolean;
    placeholder?: string;
}

export function LocalityCombobox({
    value = '',
    onChange,
    onSelectId,
    countryJa,
    disabled,
    placeholder = '例: Napa Valley'
}: LocalityComboboxProps) {
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Use a ref to track composition state prevents re-renders during IME
    const isComposingRef = useRef(false);

    // Debounce ref
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Ref for click outside
    const containerRef = useRef<HTMLDivElement>(null);

    // Ref to track if the current value was just selected from suggestion
    // to avoid re-triggering search immediately upon selection
    const isSelectionRef = useRef(false);

    // Close suggestions on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch logic
    const fetchSuggestions = async (searchTerm: string, country: string | null | undefined) => {
        if (!searchTerm || searchTerm.length < 2) {
            setSuggestions([]);
            return;
        }

        setIsLoading(true);
        try {
            const p = new URLSearchParams();
            p.set('q', searchTerm);
            if (country) p.set('country_ja', country);
            p.set('limit', '12');

            const res = await fetch(`/api/geo/suggest?${p.toString()}`);
            if (!res.ok) throw new Error('API Error');
            const data = await res.json();
            setSuggestions(Array.isArray(data) ? data : []);
            setShowSuggestions(true);
        } catch (e) {
            console.error(e);
            setSuggestions([]); // quietly fail
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        onChange(newValue);
        if (onSelectId) onSelectId(null); // Clear ID on any manual edit

        // Reset selection flag because user is typing
        isSelectionRef.current = false;

        // Clear previous timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Debounce fetch
        // Only fetch if not composing and length >= 2
        if (!isComposingRef.current && newValue.length >= 2) {
            timeoutRef.current = setTimeout(() => {
                fetchSuggestions(newValue, countryJa);
            }, 200); // 200ms debounce
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const handleCompositionStart = () => {
        isComposingRef.current = true;
    };

    const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
        isComposingRef.current = false;
        // Trigger search after composition ends if needed
        // The Input change event usually fires with the final value too, but timing varies.
        // e.currentTarget.value is the finalized text.
        const newValue = e.currentTarget.value;
        // Force a check/fetch
        if (newValue.length >= 2) {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                fetchSuggestions(newValue, countryJa);
            }, 200);
        }
    };

    const handleSelect = (s: Suggestion) => {
        // Prefer Japanese name if available and suitable? 
        // The requirement says "Primary line: name_ja if present else name".
        // But for the VALUE to save, usually we want the Name used in the UI (User Preference).
        // If the user is Japanese, they might prefer Name JA.
        // However, the input is free text.
        // Let's set the input to the primary display name (JA if exists, else EN).
        // OR should we save the standardized English name?
        // "User can freely continue editing".
        // The user requirement says "Input is always free".
        // "Return: name, name_ja ...".
        // Let's use name_ja if available, else name.

        const displayVal = s.name_ja || s.name;

        isSelectionRef.current = true; // Mark as selection to potentially skip re-fetch (though onChange triggers it)
        onChange(displayVal);
        if (onSelectId) onSelectId(s.id);
        setShowSuggestions(false);

        // Don't clear suggestions immediately? No, close list.
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
        // Arrow keys could navigate list, but keeping it simple for now (mouse/tap primarily)
    };

    return (
        <div className="relative w-full" ref={containerRef}>
            <div className="relative">
                <input
                    type="text"
                    className="w-full input pr-8" // matches generic 'input' class in WineForm + padding for icon
                    value={value}
                    onChange={handleInputChange}
                    onCompositionStart={handleCompositionStart}
                    onCompositionEnd={handleCompositionEnd}
                    onFocus={() => {
                        if (value.length >= 2 && !isSelectionRef.current && suggestions.length > 0) {
                            setShowSuggestions(true);
                        }
                    }}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                    placeholder={placeholder}
                    autoComplete="off"
                />
                {isLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    </div>
                )}
            </div>

            {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto text-sm">
                    {suggestions.map((s) => (
                        <li
                            key={s.id}
                            onClick={() => handleSelect(s)}
                            className="px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0"
                        >
                            <div className="flex flex-col">
                                <span className="font-medium text-gray-900">
                                    {s.name_ja || s.name}
                                    {/* If we show JA, show EN in parens? Or just use secondary. */}
                                </span>
                                <span className="text-xs text-gray-500 truncate">
                                    {/* Secondary Line: EN Name (if different), Level, Parent Hint */}
                                    {s.name_ja && s.name !== s.name_ja ? `${s.name} · ` : ''}
                                    {s.level}
                                    {s.parent_hint ? ` · ${s.parent_hint}` : ''}
                                    {s.country && s.country !== countryJa ? ` · ${s.country}` : ''}
                                    {/* Note: logic for country display is approximate since we have countryJa which is JA label vs s.country which is EN */}
                                </span>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

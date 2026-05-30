import { useState, useEffect, useCallback } from 'react';

const RECENT_KEY = 'winenotes_aroma_recent_v1';
const FREQ_KEY = 'winenotes_aroma_freq_v1';
const MAX_ITEMS = 12;

function readStoredRecents(): string[] {
    if (typeof window === 'undefined') return [];

    try {
        const storedRecent = localStorage.getItem(RECENT_KEY);
        if (!storedRecent) return [];
        const parsed: unknown = JSON.parse(storedRecent);
        return Array.isArray(parsed)
            ? parsed.filter((item): item is string => typeof item === 'string').slice(0, MAX_ITEMS)
            : [];
    } catch (e) {
        console.error('Failed to load recent aromas', e);
        return [];
    }
}

function readStoredFrequents(): string[] {
    if (typeof window === 'undefined') return [];

    try {
        const storedFreq = localStorage.getItem(FREQ_KEY);
        if (!storedFreq) return [];
        const parsed: unknown = JSON.parse(storedFreq);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
        const freqMap = parsed as Record<string, number>;
        return Object.entries(freqMap)
            .sort(([, a], [, b]) => b - a)
            .map(([term]) => term)
            .slice(0, MAX_ITEMS);
    } catch (e) {
        console.error('Failed to load frequent aromas', e);
        return [];
    }
}

export function useAromaHistory() {
    const [recents, setRecents] = useState<string[]>([]);
    const [frequents, setFrequents] = useState<string[]>([]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setRecents(readStoredRecents());
            setFrequents(readStoredFrequents());
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, []);

    const addHistory = useCallback((term: string) => {
        // Update Recents
        setRecents(prev => {
            const next = [term, ...prev.filter(t => t !== term)].slice(0, MAX_ITEMS);
            localStorage.setItem(RECENT_KEY, JSON.stringify(next));
            return next;
        });

        // Update Frequents
        setFrequents(prevList => {
            try {
                const storedFreq = localStorage.getItem(FREQ_KEY);
                const freqMap: Record<string, number> = storedFreq ? JSON.parse(storedFreq) : {};

                freqMap[term] = (freqMap[term] || 0) + 1;
                localStorage.setItem(FREQ_KEY, JSON.stringify(freqMap));

                // Return new sorted list (derived from map, not just prevList)
                const sorted = Object.entries(freqMap)
                    .sort(([, a], [, b]) => b - a)
                    .map(([t]) => t)
                    .slice(0, MAX_ITEMS);
                return sorted;
            } catch (e) {
                console.error('Failed to update frequent aromas', e);
                return prevList;
            }
        });
    }, []);

    return { recents, frequents, addHistory };
}

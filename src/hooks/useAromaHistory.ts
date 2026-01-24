import { useState, useEffect, useCallback } from 'react';

const RECENT_KEY = 'winenotes_aroma_recent_v1';
const FREQ_KEY = 'winenotes_aroma_freq_v1';
const MAX_ITEMS = 12;

export function useAromaHistory() {
    const [recents, setRecents] = useState<string[]>([]);
    const [frequents, setFrequents] = useState<string[]>([]);

    // Load initial state
    useEffect(() => {
        try {
            const storedRecent = localStorage.getItem(RECENT_KEY);
            if (storedRecent) {
                setRecents(JSON.parse(storedRecent));
            }

            const storedFreq = localStorage.getItem(FREQ_KEY);
            if (storedFreq) {
                const freqMap: Record<string, number> = JSON.parse(storedFreq);
                // Convert map to sorted list
                const sorted = Object.entries(freqMap)
                    .sort(([, a], [, b]) => b - a)
                    .map(([term]) => term)
                    .slice(0, MAX_ITEMS);
                setFrequents(sorted);
            }
        } catch (e) {
            console.error('Failed to load aroma history', e);
        }
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

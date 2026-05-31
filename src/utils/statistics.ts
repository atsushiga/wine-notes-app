
import { TastingNote } from "@/types/custom";
import dayjs from "dayjs";

export const calculateWineTypeStats = (notes: TastingNote[]) => {
    const stats: Record<string, number> = {};
    notes.forEach((note) => {
        const type = note.wine_type || "Unknown";
        stats[type] = (stats[type] || 0) + 1;
    });

    const total = notes.length;
    if (total === 0) return [];

    return Object.entries(stats).map(([name, value]) => ({
        name,
        value,
        percent: (value / total) * 100,
    }));
};

export const calculatePriceDistribution = (notes: TastingNote[], binSize: number = 2000) => {
    // Filter out notes without price
    const prices = notes
        .map((n) => n.price)
        .filter((p): p is number => typeof p === "number" && !isNaN(p));

    if (prices.length === 0) return [];

    const maxPrice = Math.max(...prices);
    // Round up max price to next bin multiple
    const maxBin = Math.ceil(maxPrice / binSize) * binSize;

    const bins = [
        { min: 0, max: 3000, label: "0-", count: 0 },
        { min: 3000, max: 5000, label: "3,000-", count: 0 },
        { min: 5000, max: 7000, label: "5,000-", count: 0 },
        { min: 7000, max: 10000, label: "7,000-", count: 0 },
        { min: 10000, max: 15000, label: "10,000-", count: 0 },
        { min: 15000, max: 20000, label: "15,000-", count: 0 },
        { min: 20000, max: 30000, label: "20,000-", count: 0 },
        { min: 30000, max: 50000, label: "30,000-", count: 0 },
        { min: 50000, max: 100000, label: "50,000-", count: 0 },
        { min: 100000, max: Infinity, label: "100,000-", count: 0 },
    ];

    prices.forEach((price) => {
        for (const bin of bins) {
            if (price >= bin.min && price < bin.max) {
                bin.count++;
                break;
            }
        }
    });

    return bins.map(b => ({
        range: b.label,
        count: b.count,
        min: b.min
    }));
};

export const calculateTrend = (notes: TastingNote[]) => {
    const trends: Record<string, number> = {};

    notes.forEach(note => {
        if (!note.date) return;
        const drinkingDate = dayjs(note.date);
        if (!drinkingDate.isValid()) return;

        const month = drinkingDate.format('YYYY-MM');
        trends[month] = (trends[month] || 0) + 1;
    });

    return Object.entries(trends).map(([month, count]) => ({
        month,
        count
    })).sort((a, b) => a.month.localeCompare(b.month));
};

export const groupByCountry = (notes: TastingNote[]) => {
    const countries: Record<string, number> = {};
    notes.forEach(note => {
        const country = note.country || "Unknown";
        countries[country] = (countries[country] || 0) + 1;
    });

    return Object.entries(countries).map(([name, value]) => ({
        name,
        value
    })).sort((a, b) => b.value - a.value);
};

export const winesInLast30Days = (notes: TastingNote[]) => {
    const thirtyDaysAgo = dayjs().subtract(30, 'day');
    return notes.filter(n => n.created_at && dayjs(n.created_at).isAfter(thirtyDaysAgo)).length;
}

export const calculateEarliestDate = (notes: TastingNote[]) => {
    if (notes.length === 0) return null;
    const sorted = [...notes].sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateA - dateB;
    });
    // Filter out potential invalid dates or use the first valid one
    const first = sorted.find(n => n.created_at);
    return first ? dayjs(first.created_at).format("YYYY/MM/DD") : null;
};

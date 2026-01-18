
import React from 'react';

interface KPICardsProps {
    totalWines: number;
    recentWines: number;
    startDate: string | null;
}

const KPICards: React.FC<KPICardsProps> = ({ totalWines, recentWines, startDate }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200">
                <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">総テイスティング本数</h3>
                <div className="flex items-baseline mt-2">
                    <p className="text-4xl font-bold text-zinc-900">{totalWines}<span className="text-lg font-normal text-zinc-500 ml-1">本</span></p>
                    {startDate && <p className="ml-4 text-sm text-zinc-400">({startDate}〜)</p>}
                </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200">
                <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">直近1ヶ月</h3>
                <p className="text-4xl font-bold text-amber-600 mt-2">{recentWines}<span className="text-lg font-normal text-zinc-500 ml-1">本</span></p>
            </div>
        </div>
    );
};

export default KPICards;

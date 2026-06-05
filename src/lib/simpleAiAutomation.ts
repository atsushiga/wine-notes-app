export interface SimpleAiAutomationSettings {
    imageOptimize: boolean;
    wineNameSearch: boolean;
    aiInfo: boolean;
}

export const defaultSimpleAiAutomationSettings: SimpleAiAutomationSettings = {
    imageOptimize: true,
    wineNameSearch: true,
    aiInfo: true,
};

export function normalizeSimpleAiAutomationSettings(settings: Partial<SimpleAiAutomationSettings>): SimpleAiAutomationSettings {
    const wineNameSearch = settings.wineNameSearch ?? defaultSimpleAiAutomationSettings.wineNameSearch;

    return {
        imageOptimize: settings.imageOptimize ?? defaultSimpleAiAutomationSettings.imageOptimize,
        wineNameSearch,
        aiInfo: wineNameSearch && (settings.aiInfo ?? defaultSimpleAiAutomationSettings.aiInfo),
    };
}

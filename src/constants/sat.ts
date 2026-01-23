export const SAT_CONSTANTS = {
    // A. 外観 (Appearance)
    APPEARANCE: {
        INTENSITY: ["淡い", "中程度", "濃い"],
        COLOR: {
            WHITE: ["緑がかったレモン色", "レモン色", "黄金色", "琥珀色", "褐色"],
            ROSE: ["ピンク色", "サーモン色", "オレンジ色"],
            RED: ["紫色", "ルビー色", "ガーネット色", "トーニー色", "褐色"],
            // Note: Orange/Sparkling not explicitly defined in prompt list for Color, 
            // but we might want defaults or fallback. Prompt specifically listed White, Rose, Red.
            // We can assume Orange uses Rose or White colors or needs its own? 
            // For now, adhering strictly to prompt.
        }
    },
    // B. 香り (Nose)
    NOSE: {
        CONDITION: ["不快 (Unclean)", "良好 (Clean)"],
        INTENSITY: ["弱い", "中程度(-)", "中程度", "中程度(+)", "強い"],
        DEVELOPMENT: ["若い", "熟成中", "熟成した", "ピークを過ぎた/疲れている"]
    },
    // C. 味わい (Palate)
    PALATE: {
        // Note: Sweetness is 1-6? "辛口" to "極甘口" = 6 items.
        SWEETNESS: ["辛口", "オフドライ", "中辛口", "中甘口", "甘口", "極甘口"],
        // Acidity / Tannin / Finish share the same scale
        SCALE_5_POINT: ["低い/短い", "中程度(-)", "中程度", "中程度(+)", "高い/長い"],
        BODY: ["ライト", "ミディアム(-)", "ミディアム", "ミディアム(+)", "フル"]
    },
    // D. 総評 (Conclusion)
    CONCLUSION: {
        QUALITY: ["粗悪", "可", "良", "非常に良い", "卓越した"],
        READINESS: ["若すぎる", "今飲めるが熟成可能", "今が飲み頃", "ピークを過ぎている"]
    }
} as const;

// Helper to get label by index (1-based for sliders is common, but array is 0-based)
// The prompt says "Slider value (e.g. 1-5)".
// So if slider is 1, we want index 0.
export const getSatLabel = (options: readonly string[], value: number): string => {
    // value expected to be 1-based index (1..N)
    const index = Math.round(value) - 1;
    return options[index] || "";
};

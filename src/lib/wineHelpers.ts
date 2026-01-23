import { SAT_CONSTANTS, getSatLabel } from '@/constants/sat';

export const round1 = (n: number) => Math.round(n * 10) / 10;

// Re-map legacy/specific helpers to SAT or keep if not covered
// Fruits Maturity -> Not strictly in SAT prompt list explicitly as a standard category?
// Prompt says: "Aromas: Structured...".
// Current code has `fruitStateLabel`.
// If not in SAT_CONSTANTS, keep loosely or adapt.
// SAT_CONSTANTS.NOSE.DEVELOPMENT is similar but for wine age, not fruit condition?
// Let's keep `fruitStateLabel` as is for now if it's not explicitly replaced, 
// OR check if it maps to something.
// The user prompt didn't explicitly mention "fruits_maturity" in the list of SAT mappings to create.
// It listed Nose -> Condition/Intensity/Development.
// So I will keep `fruitStateLabel` as is for now to avoid breaking existing logic not mentioned.

export const fruitStateLabel = (vRaw: number) => {
  const v = round1(vRaw);
  if (v === 5) return 'ドライ';
  if (v >= 4 && v < 5) return 'ジャム';
  if (v >= 3 && v < 4) return 'コンポート';
  if (v >= 2 && v < 3) return '熟した';
  return 'フレッシュ';
};

export const oakAromaLabel = (vRaw: number) => {
  const v = round1(vRaw);
  if (v === 1) return 'なし';
  if (v > 1 && v <= 2) return '弱い';
  if (v > 2 && v <= 3) return 'やや弱い';
  if (v > 3 && v <= 4) return 'やや強い';
  return '強い';
};

export const worldLabel = (vRaw: number) => {
  const v = round1(vRaw);
  if (v <= 1.5) return '旧世界的';
  if (v <= 2.5) return 'やや旧世界的';
  if (v <= 3.5) return '中間/モダン';
  if (v <= 4.5) return 'やや新世界的';
  return '新世界的';
};

// --- SAT Helpers ---

// Generic mapper: 0-10 -> SAT Options (Length N)
// Ranges are distributed evenly.
// e.g. 5 options:
// 0-2 -> Opt 0
// 2.5-4 -> Opt 1
// 4.5-6 -> Opt 2
// 6.5-8 -> Opt 3
// 8.5-10 -> Opt 4
export const getSatLabel0to10 = (options: readonly string[], score: number) => {
  const s = Math.min(Math.max(score, 0), 10);
  const step = 10 / options.length;
  // index = floor(s / step). But max s=10 should yield last index.
  let index = Math.floor(s / step);
  if (index >= options.length) index = options.length - 1;
  return options[index] || "";
};

export const colorLabel = (score: number, type: string) => {
  let options: readonly string[] = SAT_CONSTANTS.APPEARANCE.COLOR.RED;
  if (type === '白' || type === '発泡白') options = SAT_CONSTANTS.APPEARANCE.COLOR.WHITE;
  else if (type === 'ロゼ' || type === '発泡ロゼ' || type === 'オレンジ') options = SAT_CONSTANTS.APPEARANCE.COLOR.ROSE;
  return getSatLabel0to10(options, score);
};

export const intensityLabel = (score: number) => getSatLabel0to10(SAT_CONSTANTS.APPEARANCE.INTENSITY, score);

export const noseIntensityLabel = (score: number) => getSatLabel0to10(SAT_CONSTANTS.NOSE.INTENSITY, score);

export const palateElementLabel = (score: number, type: 'sweetness' | 'acidity' | 'tannin' | 'body' | 'finish') => {
  switch (type) {
    case 'sweetness': return getSatLabel(SAT_CONSTANTS.PALATE.SWEETNESS, score); // 1-6 Index
    case 'body': return getSatLabel0to10(SAT_CONSTANTS.PALATE.BODY, score);
    default: return getSatLabel0to10(SAT_CONSTANTS.PALATE.SCALE_5_POINT, score); // Acidity, Tannin, Finish (Med+/- scale)
  }
};

export const qualityLabel = (score: number) => getSatLabel0to10(SAT_CONSTANTS.CONCLUSION.QUALITY, score);

// Legacy Re-exports or Compatibility
export const finishLenLabel = (n: number) => palateElementLabel(n, 'finish');
export const acidityLabel = (n: number) => palateElementLabel(n, 'acidity');
export const tanninLabel = (n: number) => palateElementLabel(n, 'tannin');
export const bodyLabel = (n: number) => palateElementLabel(n, 'body');

export const rimRatioLabel = (vRaw: number) => {
  const v = round1(vRaw);
  if (v <= 2) return '紫がかった';
  if (v <= 4) return '赤みがかった';
  if (v <= 6) return 'ややオレンジがかった';
  if (v <= 8) return 'オレンジがかった';
  return 'れんが色〜茶色みを帯びた';
};

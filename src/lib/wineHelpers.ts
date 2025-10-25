// src/lib/wineHelpers.ts
export const round1 = (n: number) => Math.round(n * 10) / 10;

export const fruitStateLabel = (vRaw: number) => {
  const v = round1(vRaw);
  if (v <= 1.5) return 'フレッシュ';
  if (v <= 2.5) return '熟した';
  if (v <= 3.5) return 'コンポート';
  if (v < 5.0) return 'ジャム';
  return 'ドライ';
};

export const oakAromaLabel = (vRaw: number) => {
  const v = round1(vRaw);
  if (v === 1) return 'なし';
  if (v <= 2) return '弱い';
  if (v <= 3) return 'やや弱い';
  if (v <= 4) return 'やや強い';
  return '強い';
};

export const acidityLabel = (vRaw: number) => {
  const v = round1(vRaw);
  if (v <= 1.5) return '強い';
  if (v <= 2.5) return 'やや強い';
  if (v <= 3.5) return '中程度';
  if (v <= 4.5) return 'やや弱い';
  return '弱い';
};

export const tanninLabel = (vRaw: number) => {
  const v = round1(vRaw);
  if (v <= 1.5) return 'さらさらした';
  if (v <= 2.5) return '緻密';
  if (v <= 3.5) return '(中程度)';
  if (v <= 4.5) return '力強い';
  return '収斂性のある';
};

export const balanceLabel = (vRaw: number) => {
  const v = round1(vRaw);
  if (v < 3) return '流れるような';
  if (v <= 4) return '力強い';
  return '骨格のしっかりした/豊満な';
};

export const finishLenLabel = (n: number) => {
  const v = Math.max(0, Math.min(10, Math.round(n)));
  if (v <= 3) return '短い';
  if (v <= 5) return 'やや短い';
  if (v <= 8) return 'やや長い';
  return '長い';
};

export const appearanceFeatureLabel = (intensity: number) => {
  const v = round1(intensity);
  return v > 4 ? 'ガーネット' : 'ルビー';
};

export const worldLabel = (n: number) => (round1(n) <= 3 ? '旧世界' : '新世界');

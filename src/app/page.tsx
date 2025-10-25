'use client';
import { useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import dayjs from 'dayjs';
import React from 'react';
import { useEffect } from 'react';



// === 定義：画像シートを意識した選択肢 ===
const apperance = {
  clarity: [
    { label: '澄んだ', score: 1 },
    { label: '深みのある', score: 0 },
    { label: 'やや濁った', score: -1 },
    { label: '濁った', score: -2 },
  ],
  brightness: [
    { label: '輝きのある', score: 1 },
    { label: '艶のある', score: 0 },
    { label: 'モヤがかった', score: -1 },
  ],
  // hueRed: [
  //   '紫がかった','ラズベリー/チェリーレッド','ルビー','ルビー〜ガーネット','ガーネット','レンガ','褐色が強い'
  // ],
  // hueWhite: [
  //   'レモンイエロー','イエロー','麦わら','金色がかった','琥珀','褐色'
  // ],
};

// ワインの種類
const wineTypes = ['赤','白','ロゼ','オレンジ','発泡白','発泡ロゼ'] as const;

const countries = [
  'フランス','イタリア','スペイン','ドイツ','オーストリア','スイス',
  'アメリカ','カナダ','チリ','アルゼンチン','オーストラリア','ニュージーランド',
  '日本','南アフリカ','ポルトガル','ギリシャ','ジョージア','その他'
] as const;
const mainVarieties = [
  // 赤寄り
  'ピノ・ノワール','カベルネ・ソーヴィニヨン','メルロ','シラー/シラーズ',
  'サンジョヴェーゼ','ネッビオーロ','グルナッシュ','ジンファンデル',
  // 白寄り
  'シャルドネ','ソーヴィニヨン・ブラン','リースリング','シュナン・ブラン',
  'ピノ・グリ','ヴィオニエ','ゲヴュルツトラミネール',
] as const;
const noseIntensity = ['1. 閉じている','2. 控えめ','3. 開いている','4. やや強い','5. 強い'] as const;
const palateSweetness = ['辛口','やや辛口','中口','やや甘口','甘口'] as const;
const palateAcidity = ['穏やかな','やや高い','高い'] as const;
const palateTannin = ['少ない','中程度','多い'] as const;
const body = ['ライト','ミディアム','フル'] as const;
const alcohol = ['低い','中程度','やや高い','高い'] as const;
const finish = ['短い','やや短い','中程度','やや長い','長い'] as const;
const balance = ['調和的','やや粗い','荒い'] as const;
const evaluation = ['シンプル/フレッシュ','良質','複雑さ/余韻あり','秀逸'] as const;

// 代表的アロマ（必要に応じて増強してください）
const aromaGroups = [
  { name: '果実（赤）', options: ['イチゴ','ラズベリー','ブルーベリー','カシス','ブラックベリー', 'ブラックチェリー', '干しプラム'] },
  { name: '果実（白）', options: ['レモン', 'グレープフルーツ', '青リンゴ', 'リンゴ', '洋ナシ', 'アプリコット', '白桃','トロピカル', 'パッションフルーツ']},
  { name: '植物/ハーブ（赤）', options: ['バラ','スミレ', '牡丹', 'ドライハーブ', 'ピーマン', 'ユーカリ', 'ミント', '杉', '針葉樹', 'タバコ', '紅茶', 'キノコ'] },
  { name: '植物/ハーブ（白）', options: ['スイカズラ', 'アカシア', '白バラ', 'キンモクセイ', '菩提樹', 'ミント', 'アニス', 'ヴェルヴェーヌ', 'ハーブ', 'タイム', 'ヘーゼルナッツ'] },
  { name: '樽/熟成', options: ['ヴァニラ','トースト','スモーク','シナモン', 'ナツメグ', 'コーヒー','チョコレート','レザー', '黒胡椒', '丁子', '甘草', '生肉', 'ブレット'] },
  { name: '土/鉱物', options: ['土','鉛筆の芯','湿った土','石灰','火打石', 'スーボア', 'トリュフ', '樹脂'] }
] as const;

const schema = z.object({
  //テイスティング情報
  date: z.string(),
  price: z.string().optional(),          // 価格（任意）
  place: z.string().optional(),          // 飲んだ/購入した場所
  imageUrl: z.string().optional(),       // ひとまずURL（アップロードは次段）

  // ワイン情報
  wineName: z.string().min(1),
  producer: z.string().optional(),
  country: z.string().optional(),        // セレクト
  locality: z.string().optional(),       // 自由記述（地名）
  region: z.string().optional(),
  mainVariety: z.string().optional(),    // 主体の品種（セレクト）
  otherVarieties: z.string().optional(), // 自由記述
  // variety: z.string().optional(),
  additionalInfo: z.string().optional(),
  vintage: z.string().optional(),

  //外観
  wineType: z.enum(wineTypes),       // ← タブで選ぶ
  // color: z.enum(['赤','白','ロゼ', 'オレンジ','発泡白', '発泡ロゼ']),
  intensity: z.number().min(1).max(5),  // 濃淡 1-5
  rimRatio: z.number().min(0).max(10),  // 縁色調の割合（0:紫多い〜10:オレンジ多い）
  clarity: z.string(),
  brightness: z.string(),
  // hue: z.string().optional(),
  sparkleIntensity: z.string().optional(), 
  appearanceOther: z.string().optional(),
  
  //香り
  noseIntensity: z.string(),
  oldNewWorld: z.number().min(1).max(5),
  fruitsMaturity: z.number().min(1).max(5),
  aromaNeutrality: z.number().min(1).max(5),
  aromas: z.array(z.string()).optional(),
  oakAroma: z.number().min(1).max(5).optional(), 
  aromaOther: z.string().optional(), 

  //味わい
  sweetness: z.string(),
  acidity: z.string(),
  tannin: z.string().optional(), // 白の場合は不要
  body: z.string(),
  alcohol: z.string(),
  finish: z.string(),
  balance: z.string(),
  acidityScore: z.number().min(1).max(5),     // 酸味 1-5, 0.1刻み
  tanninScore: z.number().min(1).max(5),      // タンニン 〃（赤/オレンジで表示）
  balanceScore: z.number().min(1).max(5),     // 味わいのバランス 〃
  alcoholABV: z.number().min(0).max(30).optional(), // アルコール度数（数字入力）
  finishLen: z.number().min(0).max(10),       // 余韻 0-10, 1刻み
  palateNotes: z.string().optional(),         // 味わいの補足

  //総合評価
  evaluation: z.string(),
  rating: z.number().min(0).max(5),
  notes: z.string().optional(),
  vivinoUrl: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;


export default function Page() {
  const [sent, setSent] = useState<null | { ok: boolean; id?: string; error?: string }>(null);
  const { register, handleSubmit, control, watch, setValue, getValues,formState: { errors, isSubmitting } } = useForm<FormValues>({
    defaultValues: {
      // date: dayjs().format('YYYY-MM-DD'),
      date: '',
      place: '',
      price: '',
      imageUrl: '',

      wineType: '赤',
      // color: '赤',
      wineName: '',
      producer: '',
      country: '',
      locality: '',
      region: '',
      mainVariety: '',
      otherVarieties: '',
      // variety: '',
      vintage: '2022',
      additionalInfo: '',
      
      intensity: 3.0,
      rimRatio: 5.0,
      clarity: '澄んだ',
      brightness: '輝きのある',
      sparkleIntensity: '',
      appearanceOther: '',

      noseIntensity: '3. 開いている',
      oldNewWorld: 3.0,
      aromaNeutrality: 3.0,
      fruitsMaturity: 1.0,
      oakAroma: 1,
      aromas: [],
      aromaOther: '',

      sweetness: '辛口',
      acidity: 'やや高い',
      tannin: '中程度',
      body: 'ミディアム',
      alcohol: '中程度',
      finish: '中程度',
      balance: '調和的',
      acidityScore: 2.5,
      tanninScore: 2.5,
      balanceScore: 3.0,
      alcoholABV: 12.5,
      finishLen: 5,
      palateNotes: '',

      evaluation: '良質',
      rating: 3.5,
      notes: '',
      vivinoUrl: '',
    },
    resolver: zodResolver(schema)
  });

  // const color = watch('color');

  const wineType = watch('wineType');
  useEffect(() => {
    document.body.setAttribute('data-winetype', wineType ?? '');
  }, [wineType]);
  const isRed = wineType === '赤';
  const isWhite = wineType === '白';
  const isRose = wineType === 'ロゼ';
  const isOrange = wineType === 'オレンジ';
  const isSparklingWhite = wineType === '発泡白';
  const isSparklingRose = wineType === '発泡ロゼ';

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []); 

  useEffect(() => {
    if (!getValues('date')) {
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      setValue('date', `${yyyy}-${mm}-${dd}`, { shouldDirty: false });
    }
  }, []);


  // 果実の状態ラベル（上限以外は上端“未満”で扱い、5だけ厳密一致）
  const fruitStateLabel = (vRaw: number) => {
    const v = round1(Number(vRaw));
    if (v === 5) return 'ドライ';
    if (v >= 4 && v < 5) return 'ジャム';
    if (v >= 3 && v < 4) return 'コンポート';
    if (v >= 2 && v < 3) return '熟した';
    // 1.0 ≤ v < 1.5
    return 'フレッシュ';
  };

  const oakAromaLabel = (vRaw: number) => {
    const v = Math.round(vRaw * 10) / 10;
    if (v === 1) return 'なし';
    if (v > 1 && v <= 2) return '弱い';
    if (v > 2 && v <= 3) return 'やや弱い';
    if (v > 3 && v <= 4) return 'やや強い';
    return '強い';
  };

  const filteredAromaGroups = (() => {
    if (isRed) {
      // 赤ワイン → 果実（白）を非表示
      return aromaGroups.filter(g => g.name !== ('果実（白）')).filter(g => g.name !== ('植物/ハーブ（白）'));
    }
    if (isWhite) {
      // 白ワイン → 果実（赤）を非表示
      return aromaGroups.filter(g => g.name !== '果実（赤）').filter(g => g.name !== ('植物/ハーブ（赤）'));
    } 
    // それ以外（ロゼ/オレンジ/発泡白/発泡ロゼ）は全て表示
    return aromaGroups;
  })();

  const round1 = (n: number) => Math.round(n * 10) / 10;

  // === 味わいラベル用関数 ===
  // 酸味：1-1.5 強い / 1.6-2.5 やや強い / 2.6-3.5 中程度 / 3.6-4.5 やや弱い / 4.6+ 弱い
  const acidityLabel = (vRaw: number) => {
    const v = round1(vRaw);
    if (v <= 1.5) return '強い';
    if (v <= 2.5) return 'やや強い';
    if (v <= 3.5) return '中程度';
    if (v <= 4.5) return 'やや弱い';
    return '弱い';
  };

  // タンニン分：1-1.5 さらさらした / 1.6-2.5 緻密 / 2.6-3.5 (中程度) / 3.6-4.5 力強い / 4.6+ 収斂性のある
  const tanninLabel = (vRaw: number) => {
    const v = round1(vRaw);
    if (v <= 1.5) return 'さらさらした';
    if (v <= 2.5) return '緻密';
    if (v <= 3.5) return '(中程度)';
    if (v <= 4.5) return '力強い';
    return '収斂性のある';
  };

  // 味わいのバランス：1-2.9 流れるような / 3-4 力強い / 4.1-5 骨格のしっかりした/豊満な
  const balanceLabel = (vRaw: number) => {
    const v = round1(vRaw);
    if (v < 3) return '流れるような';
    if (v <= 4) return '力強い';
    return '骨格のしっかりした/豊満な';
  };

  // 余韻：0-3 短い / 4-5 やや短い / 6-9 やや長い / 10-11 長い
  const finishLabel = (vRaw: number) => {
    const v = Math.round(vRaw);
    if (v <= 3) return '短い';
    if (v <= 5) return 'やや短い';
    if (v <= 9) return 'やや長い';
    return '長い';
  };

const onSubmit = async (values: FormValues) => {
  setSent(null);

  // price を number に変換してから送信
  const payload = {
    ...values,
    price:
      values.price !== '' && values.price != null
        ? Number(values.price)
        : null,
  };

  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    setSent(json);
  } catch (err) {
    console.error('Submit error:', err);
    setSent({ ok: false, error: String(err) });
  }
};


  // ファイルのアップロード
  const onFileSelect = async (file: File) => {
    // 1) 署名URLを取得
    const r = await fetch('/api/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, contentType: file.type }),
    });
    const { putUrl, getUrl, error } = await r.json();
    if (error) throw new Error(error);

    // 2) 署名URLにPUT
    const res = await fetch(putUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!res.ok) throw new Error('Upload failed');

    // 3) 読み出しURLをフォームに保存（Sheets/Notionに保存する用）
    setValue('imageUrl', getUrl, { shouldDirty: true });  
  };

  return (
    <main data-winetype={wineType} className="min-h-dvh bg-transparent text-[var(--fg)] transition-colors duration-500">
      <h1 className="text-2xl font-semibold mb-4">ワイン・テイスティング記録</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        {/* タブ：ワインタイプ */}
        <section className="mb-4">
          <div className="flex flex-wrap gap-2">
            {wineTypes.map(t => {
              const active = wineType === t;
              return (
                <button
                  key={t}
                  type="button"
                  className={`px-3 py-1.5 rounded-full border ${active ? 'bg-black text-white' : 'bg-white'}`}
                  onClick={() => setValue('wineType', t, { shouldDirty: true })}
                >
                  {t}
                </button>
              );
            })}
          </div>
          {/* RHFに値を載せるためのhidden input */}
          <input type="hidden" {...register('wineType')} />
        </section>

        {/* 基本情報 */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="font-medium">基本情報</h2>
          <div>
            <label className="block text-sm mb-1">日付</label>
            <input type="date" className="w-full input" {...register('date')} />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-sm mb-1">飲んだ/購入した場所</label>
              <input className="w-full input" placeholder="例: 自宅 / ○○レストラン / △△ワインショップ"
                {...register('place')} />
            </div>
          </div>
          <input 
            type="file"
            accept="image/*"
            className = "sm:col-span-3 rounded-full border"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFileSelect(f).catch(err => alert(err.message));
            }}
          />
          {/* <div className="sm:col-span-3">
            <label className="block text-sm mb-1">画像URL</label>
            <input className="w-full input" placeholder="ラベル写真のURL（アップロードは次のステップで対応）"
              {...register('imageUrl')} />
          </div> */}
        </section>

        <section className="gap-4 rounded-2xl bg-white p-4 shadow-sm space-y-3">
          <h2 className="font-medium">ワイン情報</h2>
          <div className='grid grid-cols-1 sm:grid-cols-2'>
            <div>
              <label className="block text-sm mb-1">ワイン名*（例: Domaine X, cuvée）</label>
              <input className="w-full input" placeholder="Wine name" {...register('wineName')} />
              {errors.wineName && <p className="text-red-600 text-sm">必須です</p>}
            </div>
            <div>
              <label className="block text-sm mb-1">生産者</label>
              <input className="w-full input" {...register('producer')} />
            </div>
            <div>
                <label className="block text-sm mb-1">ヴィンテージ</label>
                <input className="w-full input" placeholder="例: 2021" {...register('vintage')} />
            </div>
           <div className="grid grid-cols-3 gap-2">
            <Controller
              control={control}
              name="price"
              render={({ field }) => {
                const value = field.value ?? '';
                const formatted =
                  value !== '' && !isNaN(Number(value))
                    ? Number(value).toLocaleString()
                    : '';

                return (
                  <div>
                    <label className="block text-sm mb-1">ボトル価格</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode='numeric'
                        className="flex-1 input text-right"
                        value={mounted ? formatted : ''}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^\d]/g, '');
                          field.onChange(raw);
                        }}
                        autoComplete="off" autoCorrect="off" autoCapitalize="none"
                        placeholder="4,500"
                      />
                      <span className="text-gray-600">円</span>
                    </div>
                  </div>
                );
              }}
              
            />
            </div>
            {/* 色（wineTypeの値を表示） */}
            <div>
              <label className="block text-sm mb-1">色</label>
              <input
                type="text"
                value={watch('wineType') ?? ''}
                readOnly
                className="w-full input bg-gray-50 text-gray-700 cursor-default"
              />
            </div>
          </div>
          <h3 className="font-medium">生産地</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">国</label>
              <select className="w-full input" {...register('country')}>
                <option value="">未選択</option>
                {countries.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">地名（地域/村/畑など）</label>
              <input className="w-full input" placeholder="例: ブルゴーニュ／ニュイ＝サン＝ジョルジュ／レ・ダモード"
                {...register('locality')} />
            </div>
          </div>
          <h3 className="font-medium">品種</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">主体の品種</label>
              <select className="w-full input" {...register('mainVariety')}>
                <option value="">未選択</option>
                {mainVarieties.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">その他（補助品種・ブレンド等）</label>
              <input className="w-full input" placeholder="例: プティ・ヴェルド 5% など"
                {...register('otherVarieties')} />
            </div>
          </div>

          {/* 補足情報（自由入力） */}
            <div className="sm:col-span-3">
              <label className="block text-sm mb-1">補足情報（自由入力）</label>
              <textarea
                className="w-full input h-28"
                placeholder="例: 畑情報、区画、樹齢、醸造メモ、輸入元メモ、保存環境 など自由に"
                {...register('additionalInfo')}
              />
            </div>
        </section>
        
        {/* 外観 */}
        <section className="rounded-2xl p-4 shadow-sm bg-[var(--surface)] text-[var(--fg)] border border-[var(--border)]">
          <h2 className="font-medium">外観</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm mb-1">清澄度</label>
              <select 
                className="w-full rounded-md px-3 py-2 bg-[var(--surface)] text-[var(--fg)] border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" 
                {...register('clarity')}
              >
                {apperance.clarity.map(v => (
                  <option key={v.label} value={v.label}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">輝き</label>
              <select className="w-full input" {...register('brightness')}>
                {apperance.brightness.map(v => (
                  <option key={v.label} value={v.label}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 濃淡 1-5 */}
          <div>
            <label className="block text-sm mb-1">色調/濃淡（1=淡い, 5=濃い）</label>
            {isRed && (
              <p className="text-sm text-[var(--fg-muted)]">
                {(() => {
                  const v = round1(Number(watch('intensity')));
                  const label = v > 4 ? 'ガーネット' : 'ルビー';
                  return `${v.toFixed(1)}: ${label}`;
                })()}
              </p>
            )}
            {(isWhite || isSparklingWhite )&& (
              <p className="text-sm mb-1">
                {(() => {
                  const v = round1(Number(watch('intensity')));
                  const label = v > 3 ? 'イエロー' : 'レモンイエロー';
                  return `${v.toFixed(1)}: ${label}`;
                })()}
              </p>
            )}
            {(isRose || isSparklingRose )&& (
              <p className="text-sm mb-1">
                {(() => {
                  const v = round1(Number(watch('intensity')));
                  const label = v <= 3 ? '淡いピンク' : '濃いピンク';
                  return `${v.toFixed(1)}: ${label}`;
                })()}
              </p>
            )}
            {isOrange && (
              <p className="text-sm mb-1">
                {(() => {
                  const v = round1(Number(watch('intensity')));
                  const label = v <= 3 ? '淡いオレンジ' : '濃いオレンジ';
                  return `${v.toFixed(1)}: ${label}`;
                })()}
              </p>
            )}
            <Controller
              control={control}
              name="intensity"
              render={({ field }) => (
                <>
                  <div className="flex items-center gap-3">
                    <input 
                      type="range" 
                      min={1} 
                      max={5} 
                      step={0.1} 
                      list = "intensityTicks"
                      {...field} 
                      className = "w-full input-accent [&::-webkit-slider-thumb]:appearance-none range--light"
                    />
                  </div>
                  <datalist id="intensityTicks">
                    <option value="2" label="2" />
                    <option value="3" label="3" />
                    <option value="4" label="4" />
                  </datalist>
                </>
              )}
            />
          </div>

          {/* 縁の色調(赤)：紫〜オレンジの割合（0:10〜10:0） */}
          <div>
            <label className="block text-sm mb-1">縁の色調</label>
            <Controller
              control={control}
              name="rimRatio"
              render={({ field }) => {
                const v = round1(10-Number(field.value));
                const comp = round1(field.value);

                let labelLeft = '';
                let labelRight = '';
                let desc = '';

                if (isRed){
                  labelLeft = '紫';
                  labelRight = 'オレンジ';
                  desc = '10:0（紫がかった）〜 0:10（オレンジがかった）';
                } else if(isWhite || isSparklingWhite){
                  labelLeft = 'グリーン';
                  labelRight = 'ゴールド';
                  desc = '10:0（グリーンがかった）〜 0:10（黄金色がかった）';
                } else if(isRose || isSparklingRose){
                  labelLeft = 'ピンク';
                  labelRight = 'オレンジ';
                  desc = '10:0（ピンクがかった）〜 0:10（オレンジがかった）';
                } else if(isOrange){
                  labelLeft = '黄金';
                  labelRight = 'ブロンズ';
                  desc = '10:0（黄金色がかった）〜 0:10（銅色がかった）';
                }

                return (
                  <>
                    <p className="text-sm">
                      {labelLeft} {v.toFixed(1)} : {labelRight} {comp.toFixed(1)}
                    </p>
                    <div className="flex items-center gap-3">
                      <input 
                        type="range" 
                        min={0} 
                        max={10} 
                        step={0.1} 
                        list = "rimRatioTicks"
                        {...field} 
                        className="w-full accent-gray-700" 
                      />
                    </div>
                    <datalist id="rimRatioTicks">
                      <option value="1" label="1" />
                      <option value="2" label="2" />
                      <option value="3" label="3" />
                      <option value="4" label="4" />
                      <option value="5" label="5" />
                      <option value="6" label="6" />
                      <option value="7" label="7" />
                      <option value="8" label="8" />
                      <option value="9" label="9" />
                    </datalist>

                  </>
                );
              }}
            />
          </div>

          {(isSparklingWhite || isSparklingRose) && (
            <div>
              <label className="block text-sm mb-1">泡の強さ</label>
              <select 
                className="w-full rounded-md px-3 py-2 bg-[var(--surface)] text-[var(--fg)] border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                {...register('sparkleIntensity')}
              >
                {['弱い','やや弱い','中程度','やや強い','強い'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          )}

          {/* その他の外観の特徴（自由記述） */}
          <div>
            <label className="block text-sm mb-1">その他の外観の特徴</label>
            <textarea 
              className="w-full h-28 rounded-md px-3 py-2 bg-[var(--surface)] text-[var(--fg)] border border-[var(--border)] placeholder-[var(--fg-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" 
              placeholder="例: 泡のきめ細かさ、涙、濁り、ガス感、粘性 など"
              {...register('appearanceOther')} 
            />
          </div>
        </section>

        {/* 香り */}
        <section className="rounded-2xl bg-white p-4 shadow-sm space-y-3">
          <h2 className="font-medium">香り</h2>
          <div>
            <label className="block text-sm mb-1">強さ</label>
            <select className="w-full input" {...register('noseIntensity')}>
              {noseIntensity.map(v => (<option key={v} value={v}>{v}</option>))}
            </select>
          </div>

          {(isRed || isRose || isOrange) && (
            <div>
              <label className="block text-sm mb-1">
                旧/新世界（1=旧世界, 5=新世界）
              </label>

              <p className="text-sm mb-1">
                {(() => {
                  const raw = watch('oldNewWorld') ?? 3;             // ← 未定義対策でデフォルト
                  const v = round1(Number(raw));
                  const label = v <= 3 ? '旧世界' : '新世界';
                  return `${v.toFixed(1)}: ${label}`;
                })()}
              </p>

              <Controller
                control={control}
                name="oldNewWorld"
                render={({ field }) => (
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={0.1}
                      list="oldNewWorldTicks"
                      value={field.value ?? 3}                      // ← 既定値
                      onChange={(e) => field.onChange(Number(e.target.value))} // ← 数値で渡す
                      className="w-full accent-gray-700"
                    />
                  </div>
                )}
              />

              <datalist id="oldNewWorldTicks">
                <option value="2" label="2" />
                <option value="3" label="3" />
                <option value="4" label="4" />
              </datalist>
            </div>
          )}

          {/* ニュートラル vs アロマティック */}
          {(isWhite) && (
            <div>
              <label className="block text-sm mb-1">
                ニュートラル / アロマティック （1=ニュートラル, 5=アロマティック）
              </label>

              <p className="text-sm mb-1">
                {(() => {
                  const v = round1(Number(watch('aromaNeutrality')));
                  const label = v <= 3 ? 'ニュートラル' : 'アロマティック';
                  return `${v.toFixed(1)}: ${label}`;
                })()}
              </p>

              <Controller
                control={control}
                name="aromaNeutrality"
                render={({ field }) => (
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={0.1}
                      list = "aromaNeutralityTicks"
                      {...field}
                      className="w-full accent-gray-700"
                    />
                    <datalist id="aromaNeutralityTicks">
                      <option value="2" label="2" />
                      <option value="3" label="3" />
                      <option value="4" label="4" />
                    </datalist>

                  </div>
                )}
              />
            </div>
          )}
          

          {/* 果実の状態（1–5 / 0.1刻み） → 赤ワインの時のみ表示 */}
          {(isRed || isRose || isOrange) && (
            <div className="mb-3">
              <label htmlFor="fruitsMaturity" className="block text-sm mb-1">
                果実の状態
              </label>
              <Controller
                control={control}
                name="fruitsMaturity"
                render={({ field }) => {
                  const v = round1(Number(field.value));
                  return (
                    <>
                      {/* スライダー上に「数値: ラベル」を表示 */}
                      <p className="text-sm mb-1">
                        {v.toFixed(1)}: {fruitStateLabel(v)}
                      </p>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={1}
                          max={5}
                          step={0.1}
                          list = "fruitsMaturityTicks"
                          value={field.value}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                          className="w-full accent-gray-700"
                        />
                      </div>
                      <datalist id="fruitsMaturityTicks">
                        <option value="2" label="2" />
                        <option value="3" label="3" />
                        <option value="4" label="4" />
                      </datalist>
                    </>
                  );
                }}
              />
            </div>
          )}

          {/* 樽香（1–5 / 0.5刻み） */}
          <div className="mt-3">
            <label htmlFor="oakAroma" className="block text-sm mb-1">樽香</label>

            <Controller
              control={control}
              name="oakAroma"
              render={({ field }) => {
                const v = Math.round((field.value ?? 1) * 10) / 10;
                return (
                  <div className="flex flex-col gap-1">
                    {/* 数値とラベル表示 */}
                    <p className="text-sm mb-1">
                      {v.toFixed(1)}: {oakAromaLabel(v)}
                    </p>

                    {/* スライダー本体 */}
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        id="oakAroma"
                        min={1}
                        max={5}
                        step={0.5}
                        list="oakAromaTicks"
                        value={v}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        className="w-full accent-gray-700"
                      />
                    </div>

                    {/* 目盛り */}
                    <datalist id="oakAromaTicks">
                      <option value="1" label="1" />
                      <option value="2" label="2" />
                      <option value="3" label="3" />
                      <option value="4" label="4" />
                      <option value="5" label="5" />
                    </datalist>

                    {/* 数値ラベル */}
                    <div className="flex justify-between text-xs text-gray-500 px-1">
                      <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
                    </div>
                  </div>
                );
              }}
            />
          </div>


          {/* 特徴香 */}
          <div className="space-y-2">
            <p className="text-sm">印象（複数選択可）</p>
            <Controller
              control={control}
              name="aromas"
              render={({ field }) => (
                <div className="space-y-2">
                  {filteredAromaGroups.map(group => (
                    <div key={group.name}>
                      <p className="text-sm font-medium mb-1">{group.name}</p>
                      <div className="flex flex-wrap gap-2">
                        {group.options.map(opt => {
                          const checked = field.value?.includes(opt) ?? false;
                          return (
                            <button
                              type="button"
                              key={opt}
                              className={`px-3 py-1 rounded-full border ${checked ? 'bg-black text-white' : 'bg-white'}`}
                              onClick={() => {
                                const cur = new Set(field.value || []);
                                checked ? cur.delete(opt) : cur.add(opt);
                                field.onChange(Array.from(cur));
                              }}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            />
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium mb-1">その他のアロマ</label>
            <textarea
              className="w-full input h-20"
              placeholder="例: バター、ナッツ、蜂蜜、ペトロール、ミネラルなど自由に記載"
              {...register('aromaOther')}
            />
           </div>

        </section>

        {/* 味わい */}
        <section className="rounded-2xl bg-white p-4 shadow-sm space-y-3">
          <h2 className="font-medium">味わい</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm mb-1">甘味</label>
              <select className="w-full input" {...register('sweetness')}>
                {palateSweetness.map(v => (<option key={v} value={v}>{v}</option>))}
              </select>
            </div>
            {/* 酸味（1-5 / 0.1刻み + 目盛） */}
            <div>
              <label htmlFor="acidityScore" className="block text-sm mb-1">酸味</label>
              <Controller
                control={control}
                name="acidityScore"
                render={({ field }) => {
                  const v = round1(Number(field.value ?? 2.5));
                  return (
                    <div className="flex flex-col gap-1">
                      <p className="text-sm">{v.toFixed(1)}: {acidityLabel(v)}</p>
                      <input
                        id="acidityScore"
                        type="range"
                        min={1}
                        max={5}
                        step={0.1}
                        list="ticks_1to5"
                        value={v}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        className="w-full accent-gray-700"
                      />
                    </div>
                  );
                }}
              />
            </div>

            {/* タンニン分（赤/オレンジのみ表示） */}
            {(isRed || isOrange) && (
              <div>
                <label htmlFor="tanninScore" className="block text-sm mb-1">タンニン分</label>
                <Controller
                  control={control}
                  name="tanninScore"
                  render={({ field }) => {
                    const v = round1(Number(field.value ?? 2.5));
                    return (
                      <div className="flex flex-col gap-1">
                        <p className="text-sm">{v.toFixed(1)}: {tanninLabel(v)}</p>
                        <input
                          id="tanninScore"
                          type="range"
                          min={1}
                          max={5}
                          step={0.1}
                          list="ticks_1to5"
                          value={v}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                          className="w-full accent-gray-700"
                        />
                      </div>
                    );
                  }}
                />
              </div>
            )}

            {/* 味わいのバランス（1-5 / 0.1刻み + 目盛） */}
            <div>
              <label htmlFor="balanceScore" className="block text-sm mb-1">味わいのバランス</label>
              <Controller
                control={control}
                name="balanceScore"
                render={({ field }) => {
                  const v = round1(Number(field.value ?? 3.0));
                  return (
                    <div className="flex flex-col gap-1">
                      <p className="text-sm">{v.toFixed(1)}: {balanceLabel(v)}</p>
                      <input
                        id="balanceScore"
                        type="range"
                        min={1}
                        max={5}
                        step={0.1}
                        list="ticks_1to5"
                        value={v}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        className="w-full accent-gray-700"
                      />
                    </div>
                  );
                }}
              />
            </div>

            {/* アルコール度数（数字入力） */}
            <div>
              <label htmlFor="alcoholABV" className="block text-sm mb-1">アルコール度数（%）</label>
              <input
                id="alcoholABV"
                type="number"
                step="0.1"
                min={0}
                max={30}
                className="w-full input"
                {...register('alcoholABV', { valueAsNumber: true })}
                placeholder="例: 12.5"
              />
            </div>

            {/* 余韻（0-11 / 1刻み + 目盛） */}
            <div>
              <label htmlFor="finishLen" className="block text-sm mb-1">余韻</label>
              <Controller
                control={control}
                name="finishLen"
                render={({ field }) => {
                  const v = Math.round(Number(field.value ?? 5));
                  return (
                    <div className="flex flex-col gap-1">
                      <p className="text-sm">{v}: {finishLabel(v)}</p>
                      <input
                        id="finishLen"
                        type="range"
                        min={0}
                        max={11}
                        step={1}
                        list="ticks_0to11"
                        value={v}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        className="w-full accent-gray-700"
                      />
                    </div>
                  );
                }}
              />
            </div>

            {/* 味わいの補足（自由記述） */}
            <div>
              <label htmlFor="palateNotes" className="block text-sm mb-1">味わいの補足</label>
              <textarea
                id="palateNotes"
                className="w-full input h-24"
                placeholder="例: 温度が上がると甘味の印象が増す、時間経過でタンニンが丸くなる 等"
                {...register('palateNotes')}
              />
            </div>

            {/* 目盛（共通） */}
            <datalist id="ticks_1to5">
              <option value="1" label="1" />
              <option value="2" label="2" />
              <option value="3" label="3" />
              <option value="4" label="4" />
              <option value="5" label="5" />
            </datalist>
            <datalist id="ticks_0to11">
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i} label={String(i)} />
              ))}
            </datalist>

            <label className="block text-sm mb-1">評価</label>
            <select className="w-full input" {...register('evaluation')}>
              {evaluation.map(v => (<option key={v} value={v}>{v}</option>))}
            </select>
          </div>
        </section>

        {/* 補足 */}
        <section className="rounded-2xl bg-white p-4 shadow-sm space-y-3">
          <h2 className="font-medium">補足</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-3">
              <label className="block text-sm mb-1">Vivino URL</label>
              <input className="w-full input" placeholder="https://www.vivino.com/..." {...register('vivinoUrl')} />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-sm mb-1">メモ</label>
              <textarea className="w-full input h-28" {...register('notes')} />
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm space-y-2">
          <h2 className="font-medium">総合評価</h2>
          <Controller
            control={control}
            name="rating"
            render={({ field }) => (
              <>
                {/* 星ビジュアル */}
                <div className="relative inline-block select-none" aria-label={`Rating ${round1(field.value)} of 5`}>
                  <div className="text-2xl tracking-tight text-neutral-300">★★★★★</div>
                  <div
                    className="absolute top-0 left-0 overflow-hidden text-2xl tracking-tight text-yellow-500 pointer-events-none"
                    style={{ width: `${(Math.max(0, Math.min(5, Number(field.value))) / 5) * 100}%` }}
                  >
                    ★★★★★
                  </div>
                </div>
                {/* スライダー */}
                <div className="flex items-center gap-3 mt-1">
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={0.1}
                    value={field.value}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    className="w-full"
                  />
                  <span className="w-12 text-right">{round1(field.value).toFixed(1)}</span>
                </div>
              </>
            )}
          />
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm">推定スコア: </p>
            {/* <button
              type="submit"
              className="btn-primary relative z-[9999] !pointer-events-auto"
              onClick={() => console.log('BUTTON CLICKED')}
            >
              保存する
            </button> */}
            <button type="submit" disabled={isSubmitting} className="btn-primary !pointer-events-auto">{isSubmitting ? '送信中…' : '保存する'}</button>
          </div>
        </section>
      </form>
 
      {sent && (
        <p className={`text-sm ${sent.ok ? 'text-green-600' : 'text-red-600'}`}>
          {sent.ok ? '保存しました（ID: ' + sent.id + '）' : `保存に失敗しました: ${sent.error}`}
        </p>
      )}
 
      {/* Tailwindヘルパークラス（簡易） */}
      <style jsx global>{`
        .input { @apply rounded-xl border border-neutral-300 bg-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-800; }
        .btn-primary { @apply rounded-xl bg-neutral-900 px-4 py-2 text-white shadow-sm hover:opacity-90 disabled:opacity-50; }
      `}</style>
    </main>
  );
}
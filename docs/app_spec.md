# アプリケーション仕様書 (WineNotes)

## 1. プロジェクト概要
**WineNotes** は、ワインのテイスティングノートを記録・管理するためのアプリケーションです。
Next.js (App Router) を採用し、Supabase をバックエンド（認証・DB）として使用しています。

## 2. 技術スタック
- **Framework**: Next.js 16.1.1 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **State Management**: React Hooks
- **Form**: React Hook Form + Zod (@hookform/resolvers)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (SSR)
- **Icons**: Lucide React
- **Date Handling**: Day.js

## 3. ディレクトリ構成 (主要なもの)
- `src/app`: アプリケーションのルーティング (App Router)
- `src/components`: UIコンポーネント
- `src/utils/supabase`: Supabase クライアント設定
- `src/types`: TypeScript 型定義
- `src/middleware.ts`: 認証ミドルウェア (保護されたルートのリダイレクト処理)
- `docs`: ドキュメント・タスク管理

## 4. データモデル
### TastingNote (ワインテイスティング記録)
`src/types/custom.ts` に定義されている主要インターフェース。

| フィールド名 | 型 | 説明 |
| --- | --- | --- |
| `id` | number | 主キー |
| `wine_name` | string | ワイン名 |
| `vintage` | string? | ヴィンテージ（年） |
| `rating` | number? | 評価（スコア） |
| `image_url` | string? | 画像URL |
| `created_at` | string | 作成日時 |
| `user_id` | string? | ユーザーID |
| `price` | number? | 価格 |
| `place` | string? | 場所 |
| `producer` | string? | 生産者 |
| `country` | string? | 国 |
| `region/locality` | string? | 地域/地名 |
| `main_variety` | string? | 主体品種 |
| `wine_type` | string? | ワインタイプ |
| `intensity` | number? | 外観の濃淡 |
| `nose_intensity` | string? | 香りの強さ |
| `aromas` | string[]? | アロマ（配列表現） |
| `acidity_score` | number? | 酸味スコア |
| `tannin_score` | number? | タンニンスコア |
| `balance_score` | number? | バランススコア |
| `evaluation` | string? | 総合評価（テキスト） |
| `notes` | string? | メモ |
| `sat_...` | string? | SAT準拠の各評価項目 |

## 5. 機能一覧
### 認証
- Supabase Auth を利用
- ミドルウェアでのセッション管理とリダイレクト

### テイスティングノート登録
- フォーム入力（バリデーション付き）
- 詳細なテイスティング項目（外観・香り・味・SAT評価）

### ワイン一覧・詳細表示
- グリッド形式での一覧表示
- 動的ルーティング (`/wines/[id]`) による詳細ページ
- 詳細なテイスティングデータの表示（チャートやスコアの可視化）

### 画像管理
- 外部ドメイン（wine-note.jp）許可


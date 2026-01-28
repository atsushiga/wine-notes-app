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
| `aromas` | string[]? | アロマ（WSET Level 3準拠の階層データをフラット化して保存） |
| `acidity_score` | number? | 酸味スコア (0-10) |
| `tannin_score` | number? | タンニンスコア (0-10) |
| `body_score` | number? | ボディスクコア (0-10) |
| `finish_score` | number? | 余韻スコア (0-10) |
| `quality_score` | number? | 品質スコア (0-10) |
| `evaluation` | - | (廃止 -> quality_scoreへ移行) |
| `notes` | string? | 寸評 (自由記述) |
| `readiness` | string? | 飲み頃 |
| `color` | number? | 色調 (0-10) |
| `nose_condition` | string? | 香りのコンディション |
| `development` | string? | 熟成度 |
| `sweetness` | number? | 甘味 (1-6) |
| `terroir_info` | string? | テロワール情報 (AI取得) |
| `producer_philosophy` | string? | 生産者哲学 (AI取得) |
| `technical_details` | string? | 技術詳細 (AI取得) |
| `vintage_analysis` | string? | ヴィンテージ分析 (AI取得) |
| `search_result_tasting_note` | string? | Web上のテイスティングノート (AI取得) |
| `images` | WineImage[] | 関連画像 (1:N) |

### WineImage (ワイン画像)
| フィールド名 | 型 | 説明 |
| --- | --- | --- |
| `id` | uuid | PK |
| `tasting_note_id` | number | FK (TastingNote) |
| `url` | string | オリジナル画像のURL (APIパス) |
| `thumbnail_url` | string? | サムネイル画像のURL (APIパス) |
| `storage_path` | string? | GCS上のパス |
| `display_order` | number | 表示順 |

### GeoVocab (地名ボキャブラリー)
| フィールド名 | 型 | 説明 |
| --- | --- | --- |
| `id` | bigint | PK (Identity) |
| `name` | string | 地名 (英語/原語) |
| `name_norm` | string | 正規化名称 (検索用) |
| `name_ja` | string? | 地名 (日本語) |
| `level` | string | 地域レベル (province/region_1/region_2) |
| `country` | string | 国名 |
| `parent_hint` | string? | 親地域のヒント |


## 5. 機能一覧
### 認証
- Supabase Auth を利用
- ミドルウェアでのセッション管理とリダイレクト

### テイスティングノート登録
- フォーム入力（バリデーション付き）
- 詳細なテイスティング項目（外観・香り・味・SAT評価）
- **WSET Level 3準拠のアロマ選択**:
    - 第一/第二/第三アロマの3階層タブ表示
    - サブカテゴリによるグルーピング
    - 検索機能による横断的な用語選択
- **地名サジェスト機能**:
    - `geo_vocab` テーブル（約1900語）を利用した地名入力補完
    - 国選択に連動したフィルタリング
    - 日本語/英語によるインクリメンタルサーチ (Debounce + IME対応)
    - 候補のランキング表示 (日本語優先表示、Prefixマッチ優先)
- セッションストレージを使用したドラフト保存機能（タブ切り替え時の入力保持・タブ別独立管理）

### ワイン一覧・詳細表示
- グリッド形式での一覧表示
- **AIによる深掘り検索 (Gemini Grounding)**:
    - Gemini 2.0 Flash + Google Search Groundingを利用
    - テロワール、生産者哲学、技術詳細、ヴィンテージ、プロの評価を**日本語で**取得・保存・表示
    - **UI/UX**:
        - テイスティングフォームの最下部に配置（評価フローを阻害しないための配慮）
        - アコーディオン形式でデフォルトは「閉じる」
        - 常に表示されるフローティングアイコン（🤖）により、任意のタイミングで該当セクションへスクロール可能
            - ワイン名未入力時は無効化（ツールチップ表示）
        - 免責事項（参考情報である旨）を明記

### ユーザー設定
- **設定ページ**: フッターナビゲーションから「設定」タブでアクセス
- **機能**:
  - ログイン中のユーザーメールアドレスの表示
  - メールアドレス変更機能
  - パスワード変更機能
  - ログアウト機能

### 統計ダッシュボード
- **KPIカード**: 総テイスティング本数（開始日）、直近30日の本数
- **チャート**:
  - ワインタイプ比率 (Stack)
  - 飲酒トレンド (Line)
  - 価格帯分布 (Horizontal Bar)
  - コスパ分析 (Scatter: 価格 vs 評価)
- **産地マップ**:
  - 世界地図上のヒートマップ
  - ホバー時に国旗・国名・本数を表示
- **レイアウト**:
  - 2カラムレイアウト（左: タイプ/トレンド, 右: 価格）+ 下部（コスパ, 地図）
  - 全体ライトテーマ強制
### 画像管理
- **ストレージ**: Google Cloud Storage (GCS)
- **構成**:
    - `uploads/YYYY/MM/filename`: オリジナル画像
    - `uploads/YYYY/MM/thumb_v2_filename`: サムネイル画像 (400x400, rotate適用済み)
- **アクセス**: `/api/images/[...path]` エンドポイントを経由して認証付きで配信（ただし一覧での表示用にはMiddlewareで除外）
- **複数画像**: `wine_images` テーブルによる 1:N 管理
- **サムネイル**: アップロード時にクライアント(Canvas)でプレビュー用生成、サーバーサイド(Sharp)で保存用生成・回転補正


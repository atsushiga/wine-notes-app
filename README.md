# Wine Notes

Wine Notes は、ワインのテイスティング記録、画像管理、AIによる参考情報生成をまとめる Next.js アプリです。

## Tech Stack

- Next.js App Router
- TypeScript
- Supabase Auth / PostgreSQL
- Google Cloud Storage
- Gemini / OpenAI
- Playwright

## Requirements

- Node.js 20
- npm
- Supabase project
- Google Cloud Storage bucket
- Gemini API key
- OpenAI API key

## Environment Variables

`.env.local` に次の値を設定します。

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

GCS_BUCKET_NAME=your_gcs_bucket
GCP_PROJECT_ID=your_gcp_project
GOOGLE_CLIENT_EMAIL=your_service_account_email
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key
GOOGLE_GENERATIVE_AI_MODEL=gemini-2.5-flash

OPENAI_API_KEY=your_openai_api_key
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
OPENAI_IMAGE_MODEL=gpt-image-2
OPENAI_IMAGE_QUALITY=high

NEXT_PUBLIC_SITE_URL=https://www.wine-note.jp
ADMIN_EMAILS=admin@example.com,ops@example.com
```

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm run lint
npm run build
npm run test:e2e
npm audit --omit=dev
```

## Supabase

Migrations are stored in `supabase/migrations`.

```bash
npx supabase db push --dry-run
npx supabase db push
```

Important tables:

- `profiles`
- `tasting_notes`
- `wine_images`
- `ai_explanations`
- `usage_events`

RLS is required for user-owned data. Do not grant anonymous write access to user data tables.

## Auth Email

Signup and password flows use Supabase Auth email links. Production should use a custom SMTP provider.

- Setup guide: `docs/auth-resend.md`
- Confirm signup template: `supabase/email-templates/confirm-signup.html`
- Magic link template: `supabase/email-templates/magic-link.html`

## Google Cloud Storage

Apply CORS before using signed uploads:

```bash
gcloud storage buckets update gs://YOUR_BUCKET --cors-file=infra/gcs/cors.json
```

Uploaded images are served through `/api/images/...` with authentication and owner checks.

## Public Beta Operations

- Release implementation plan: `PUBLIC_RELEASE_IMPLEMENTATION_PLAN.md`
- Beta runbook: `docs/beta-runbook.md`
- Usage monitoring SQL: `docs/usage-monitoring.sql`
- Security audit notes: `docs/security-audit.md`

Admin usage summary is available to signed-in users whose email is listed in `ADMIN_EMAILS`:

Open `/api/admin/usage?days=7` in an authenticated browser session.

## Legal Pages

The app includes:

- `/terms`
- `/privacy`
- `/contact`

Update these texts before full general availability if formal legal review is required.

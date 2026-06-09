# Closed Beta Runbook

## Pre-launch Checklist

- Apply all Supabase migrations.
- Confirm production environment variables are set in the hosting provider.
- Apply `infra/gcs/cors.json` to the production GCS bucket.
- Confirm `/api/health` returns `200`.
- Confirm unauthenticated access to `/`, `/tasting-notes`, `/statistics`, `/settings`, `/wines/{id}`, `/ai-explainer` redirects to `/login`.
- Confirm unauthenticated access to `/api/submit`, `/api/stt`, `/api/upload`, `/api/upload-url`, `/api/images/...` returns `401`.
- Confirm `/terms`, `/privacy`, and `/contact` are publicly reachable.
- Confirm account deletion removes test user records and GCS objects.
- Confirm `npm audit --omit=dev` has no critical or high vulnerabilities.

## Daily Beta Checks

- Review server errors in the hosting provider logs.
- Review Supabase Auth signups and failed login spikes.
- Review `usage_events` for unusually high AI, STT, image upload, or signup email usage.
- Review GCS storage growth and unexpected object prefixes.
- Check support inbox for deletion, privacy, and billing/cost reports.

## Incident Checklist

- Disable public signup or restrict invites if abuse is detected.
- Lower daily limits in `src/lib/usageLimits.ts` and redeploy if API cost spikes.
- Rotate OpenAI, Gemini, Supabase service role, and GCS credentials if leakage is suspected.
- Revoke suspicious users in Supabase Auth.
- Preserve relevant logs before cleanup.

## Useful Commands

```bash
npm run lint
npm run build
npm run test:e2e
npm audit --omit=dev
```

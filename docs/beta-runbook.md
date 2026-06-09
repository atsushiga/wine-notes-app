# Closed Beta Runbook

This runbook covers the minimum operating workflow for a limited public beta. Keep product changes small during beta and prefer configuration, limit, or access-control mitigations before code changes during incidents.

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

## Launch Day Smoke Test

Run these checks against the production URL after deployment.

1. Sign up with a new test email and confirm the email flow.
2. Log in, create one tasting note, upload at least one image, and confirm the image loads through `/api/images/...`.
3. Generate one AI explanation and confirm generated/source-backed images are labeled.
4. Export user data from Settings and confirm the JSON contains notes, images, profile, and AI explanations.
5. Delete the test account and confirm a new login attempt fails.
6. Visit `/offline`, `/robots.txt`, `/sitemap.xml`, `/terms`, `/privacy`, and `/contact`.
7. Trigger an invalid URL and confirm the 404 page renders cleanly.

## Daily Beta Checks

- Review server errors in the hosting provider logs.
- Review Supabase Auth signups and failed login spikes.
- Review `usage_events` for unusually high AI, STT, image upload, or signup email usage.
- Review GCS storage growth and unexpected object prefixes.
- Check support inbox for deletion, privacy, and billing/cost reports.

## Weekly Beta Checks

- Run `npm audit --omit=dev` and record any accepted residual risk in `docs/security-audit.md`.
- Review `docs/usage-monitoring.sql` outputs for usage outliers and failed operations.
- Spot-check exported data for one internal account.
- Confirm account deletion still removes Supabase rows and GCS objects.
- Review legal page wording before increasing the tester pool.
- Review support themes and convert repeated issues into product fixes.

## Support Triage

Use the smallest data scope needed to answer a support request.

1. Confirm the requester owns the email address on the account.
2. Classify the request as account access, data export, account deletion, AI result quality, image upload, billing/cost concern, privacy/security, or bug report.
3. Ask for timestamp, browser/device, page URL, and screenshot only when needed.
4. Check hosting logs first for request failures, then Supabase Auth, then database rows.
5. Avoid reading tasting note content unless the user explicitly asks for help with that content.
6. Record the outcome and whether code, docs, limits, or user education is required.

## User Data Requests

### Export

- First ask the user to use Settings > データのエクスポート.
- If self-export fails, verify authentication state and check `/api/export` logs.
- The export should include profile, tasting notes, wine images, and AI explanations.
- Do not send exported data to a different email address than the account email.

### Deletion

- First ask the user to use Settings > アカウント削除.
- If self-deletion fails, inspect errors from `deleteAccount` and GCS object deletion logs.
- Confirm deletion removes `profiles`, `tasting_notes`, `wine_images`, `ai_explanations`, `usage_events`, and the Supabase Auth user.
- If GCS object deletion partially fails, preserve the error log and retry only the affected object keys.

## Common Issues

### Cannot log in

- Check Supabase Auth user status and whether email confirmation is pending.
- Confirm production email templates and redirect URLs are correct.
- For forgotten passwords, direct the user to `/reset-password`.
- If several users report the same issue, test the full signup, login, and password reset flow before changing code.

### Image upload fails

- Confirm the user is authenticated.
- Check GCS credentials, bucket name, CORS, and signed upload route logs.
- Check daily upload limits in `src/lib/usageLimits.ts`.
- Confirm the image type is supported and the file is within the beta size expectations.

### AI generation fails or costs spike

- Check provider status and application logs.
- Review `usage_events` by action and subject using `docs/usage-monitoring.sql`.
- Lower limits in `src/lib/usageLimits.ts` if usage is legitimate but too expensive.
- Restrict invites or disable signup if usage appears abusive.

### Source or generated image confusion

- Confirm the UI shows `出典画像`, `AI生成画像`, or `出典情報をもとにAI生成`.
- Use `docs/ai-visual-disclosure.md` as the content rule reference.
- Correct misleading captions before increasing tester volume.

## Incident Checklist

- Disable public signup or restrict invites if abuse is detected.
- Lower daily limits in `src/lib/usageLimits.ts` and redeploy if API cost spikes.
- Rotate OpenAI, Gemini, Supabase service role, and GCS credentials if leakage is suspected.
- Revoke suspicious users in Supabase Auth.
- Preserve relevant logs before cleanup.

## Severity Guide

- `SEV1`: Data exposure, credential leak, destructive deletion bug, or uncontrolled provider spend. Restrict access immediately and preserve logs.
- `SEV2`: Login outage, upload outage, AI generation outage, or account deletion/export failure affecting multiple users. Mitigate within the same day.
- `SEV3`: Individual support issue, confusing UI, non-blocking rendering bug, or documentation gap. Batch into normal product work.

## Useful Commands

```bash
npm run lint
npm run build
npm run test:e2e
npm audit --omit=dev
```

## Useful References

- Release plan: `PUBLIC_RELEASE_IMPLEMENTATION_PLAN.md`
- Security audit: `docs/security-audit.md`
- Usage monitoring SQL: `docs/usage-monitoring.sql`
- Auth email setup: `docs/auth-resend.md`
- AI visual disclosure: `docs/ai-visual-disclosure.md`

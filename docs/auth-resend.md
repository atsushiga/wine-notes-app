# Supabase Auth メールを Resend で送る設定

このアプリのアカウント作成は `src/app/api/auth/invite/route.ts` で Supabase Auth の `signInWithOtp` を使っています。メール本文と差出人はアプリコードではなく、Supabase Auth の SMTP / Email Template 設定で管理します。

## 推奨構成

- 送信サービス: Resend
- Supabase 設定: Authentication の Custom SMTP
- 差出人名: `WINE NOTE`
- From: `no-reply@auth.<your-domain>`
- メールテンプレート: `Magic Link / OTP`

Resend は Supabase 公式の Custom SMTP 対応サービスに含まれています。Supabase の標準 SMTP は検証用で、Custom SMTP 未設定だとチーム外メールに送れない制限や低い送信上限があります。

## Resend 側

1. Resend で送信用ドメインを追加する。
2. DNS に Resend が提示する SPF / DKIM / DMARC 関連レコードを追加する。
3. ドメイン検証が完了するまで待つ。
4. Supabase 用の API key を作る。

認証メール用ドメインは、マーケティングメールと分けるのが望ましいです。例: `auth.example.com`

## Supabase 側

最短は Resend の Supabase Integration を使います。手動設定する場合は Supabase Dashboard の `Authentication` -> `Settings` -> `SMTP Provider` / `Custom SMTP` に次を設定します。

| 項目 | 値 |
| --- | --- |
| Enable Custom SMTP | enabled |
| Sender email | `no-reply@auth.<your-domain>` |
| Sender name | `WINE NOTE` |
| Host | `smtp.resend.com` |
| Port | `587` |
| Username | `resend` |
| Password | Resend API key |

Resend SMTP の公式値は Host `smtp.resend.com`, Username `resend`, Password `YOUR_API_KEY` です。Port は `587` の STARTTLS を基本にします。

## リダイレクト URL

Supabase Dashboard の `Authentication` -> `URL Configuration` で、利用する URL を許可します。

- Local: `http://localhost:3000/auth/callback`
- ngrok: `https://<your-ngrok-domain>/auth/callback`
- Production: `https://<your-production-domain>/auth/callback`

このアプリはメール送信時の request origin から `redirectTo = <origin>/auth/callback` を組み立てます。許可リストにない origin から送ると、リンククリック後の認証に失敗します。

## Email Template

Supabase Dashboard の `Authentication` -> `Email Templates` で次を編集します。

このアプリは `signInWithOtp({ shouldCreateUser: true })` を使っています。未登録メールアドレスでは Supabase がユーザー作成を行うため、初回メールは `Confirm signup` テンプレートが使われます。既存の未完了ユーザーに再送する場合などは `Magic Link` テンプレートが使われます。そのため、両方を設定します。

### Confirm signup

- Subject: `WINE NOTE のアカウント確認`
- Body: `supabase/email-templates/confirm-signup.html` の内容を貼り付ける

### Magic Link

- Subject: `WINE NOTE の確認リンク`
- Body: `supabase/email-templates/magic-link.html` の内容を貼り付ける

`{{ .ConfirmationURL }}` は削除しないでください。メール内の認証リンクに必要です。

## 動作確認

1. `/signup` から未登録メールアドレスを送信する。
2. Resend Dashboard の Emails / Logs に送信履歴が出ることを確認する。
3. メールのリンクを開く。
4. 新規ユーザーは `/set-password` に進むことを確認する。
5. `onboarding_state = completed` の既存ユーザーは、登録画面で「既に登録済み」と表示されることを確認する。

## 参照

- Supabase Custom SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- Supabase Email Templates: https://supabase.com/docs/guides/auth/auth-email-templates
- Resend SMTP: https://resend.com/docs/send-with-smtp
- Resend + Supabase: https://resend.com/docs/knowledge-base/getting-started-with-resend-and-supabase

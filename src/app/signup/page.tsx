'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FORM_CONTROL_BASE } from '@/constants/styles';

const ERROR_MESSAGES: Record<string, string> = {
  account_exists: 'このメールアドレスは既に登録済みです。ログイン画面からログインしてください。',
  auth_not_configured: '認証の環境変数が不足しています。',
  email_address_not_authorized: 'Supabaseの標準メール送信では、このメールアドレスに送信できません。Supabaseのチームメンバーのメールを使うか、Custom SMTPを設定してください。',
  invalid_email: '有効なメールアドレスを入力してください。',
  over_email_send_rate_limit: 'メール送信の上限に達しています。時間をおいてからもう一度お試しください。',
  over_request_rate_limit: 'リクエストの上限に達しています。時間をおいてからもう一度お試しください。',
};

export default function SignupPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.elements.namedItem('email') as HTMLInputElement)?.value?.trim();
    if (!email) return;
    setStatus('loading');
    setErrorMessage(null);
    try {
      const res = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const errorCode = typeof data?.error === 'string' ? data.error : null;
        setStatus('error');
        setErrorMessage(
          errorCode
            ? (ERROR_MESSAGES[errorCode] ?? '送信に失敗しました。しばらく経ってからお試しください。')
            : '送信に失敗しました。しばらく経ってからお試しください。',
        );
        return;
      }
      setStatus('success');
    } catch {
      setStatus('error');
      setErrorMessage('送信に失敗しました。しばらく経ってからお試しください。');
    }
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center px-4">
      <h1 className="text-xl font-semibold text-[var(--text)]">アカウント作成</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        メールアドレスを入力してください。確認リンクを送信します。
      </p>
      {status === 'success' ? (
        <p className="mt-6 text-sm text-[var(--text)]" role="status">
          送信しました。メールのリンクからパスワードを設定してください。
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-[var(--text)]">
              メールアドレス
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              disabled={status === 'loading'}
              className={FORM_CONTROL_BASE}
            />
          </div>
          {errorMessage && (
            <p className="text-sm text-[var(--color-error)]" role="alert">
              {errorMessage}
            </p>
          )}
          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-70"
          >
            {status === 'loading' ? '送信中...' : '確認メールを送信'}
          </button>
        </form>
      )}
      <p className="mt-4 text-center text-sm text-[var(--text-muted)]">
        <Link href="/login" className="underline hover:no-underline">
          ログインはこちら
        </Link>
      </p>
    </div>
  );
}

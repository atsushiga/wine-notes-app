'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FORM_CONTROL_BASE } from '@/constants/styles';

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
        setStatus('error');
        setErrorMessage('送信に失敗しました。しばらく経ってからお試しください。');
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
        メールアドレスを入力してください。招待リンクを送信します。
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
            <p className="text-sm text-red-500" role="alert">
              {errorMessage}
            </p>
          )}
          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full rounded-md bg-[var(--ring)] px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-70"
          >
            {status === 'loading' ? '送信中...' : '招待メールを送信'}
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

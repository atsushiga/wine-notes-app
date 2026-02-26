'use client';

import { useActionState } from 'react';
import { setPasswordAction } from './actions';
import { FORM_CONTROL_BASE } from '@/constants/styles';

export function SetPasswordForm() {
  const [state, formAction] = useActionState(
    async (_: unknown, formData: FormData) => setPasswordAction(formData),
    null as { error?: string } | null,
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-[var(--text)]">
          パスワード
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          className={FORM_CONTROL_BASE}
        />
      </div>
      <div>
        <label htmlFor="confirm" className="mb-1 block text-sm font-medium text-[var(--text)]">
          パスワード（確認）
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          className={FORM_CONTROL_BASE}
        />
      </div>
      {state?.error && (
        <p className="text-sm text-red-500" role="alert">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        className="w-full rounded-md bg-[var(--ring)] px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
      >
        設定して続ける
      </button>
    </form>
  );
}

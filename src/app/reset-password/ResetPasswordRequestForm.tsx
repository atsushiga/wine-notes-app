"use client";

import { useActionState } from "react";
import { requestPasswordResetAction } from "./actions";
import { FORM_CONTROL_BASE } from "@/constants/styles";

export function ResetPasswordRequestForm() {
  const [state, formAction, isPending] = useActionState(
    async (_: unknown, formData: FormData) => requestPasswordResetAction(formData),
    null as { error?: string; message?: string } | null,
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
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
          className={FORM_CONTROL_BASE}
        />
      </div>
      {state?.error && (
        <p className="text-sm text-[var(--color-error)]" role="alert">
          {state.error}
        </p>
      )}
      {state?.message && (
        <p className="rounded-md border border-[var(--color-success)]/30 bg-[var(--color-success-soft)] px-3 py-2 text-sm text-[var(--color-success)]" role="status">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-70"
      >
        {isPending ? "送信中..." : "再設定メールを送信"}
      </button>
    </form>
  );
}

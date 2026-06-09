"use client";

import { useActionState } from "react";
import { updatePasswordAfterResetAction } from "./actions";
import { FORM_CONTROL_BASE } from "@/constants/styles";

export function UpdatePasswordForm() {
  const [state, formAction, isPending] = useActionState(
    async (_: unknown, formData: FormData) => updatePasswordAfterResetAction(formData),
    null as { error?: string } | null,
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-[var(--text)]">
          新しいパスワード
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
          新しいパスワード（確認）
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
        disabled={isPending}
        className="w-full rounded-md bg-[var(--ring)] px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-70"
      >
        {isPending ? "更新中..." : "パスワードを更新"}
      </button>
    </form>
  );
}

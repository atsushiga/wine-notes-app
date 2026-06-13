"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { deleteAccount } from "@/app/auth/actions";

export default function DeleteAccountSection() {
    const [confirmText, setConfirmText] = useState("");
    const [message, setMessage] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const canDelete = confirmText === "DELETE";

    const handleDelete = () => {
        if (!canDelete) return;
        setMessage(null);
        startTransition(async () => {
            const result = await deleteAccount();
            if (result?.error) {
                setMessage(result.error);
            }
        });
    };

    return (
        <div className="rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error-soft)] p-5">
            <h2 className="text-base font-semibold text-[var(--color-error)]">退会とデータ削除</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-error)]">
                退会すると、プロフィール、テイスティング記録、画像、AI解説履歴を削除します。この操作は取り消せません。
            </p>
            <label htmlFor="delete-confirm" className="mt-4 block text-sm font-medium text-[var(--color-error)]">
                確認のため DELETE と入力
            </label>
            <input
                id="delete-confirm"
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                className="mt-2 w-full rounded-md border border-[var(--color-error)]/35 bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-error)]/35"
                autoComplete="off"
            />
            {message && (
                <p className="mt-3 text-sm text-[var(--color-error)]" role="alert">
                    {message}
                </p>
            )}
            <button
                type="button"
                onClick={handleDelete}
                disabled={!canDelete || isPending}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--color-error-solid)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
                {isPending ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                アカウントを削除する
            </button>
        </div>
    );
}

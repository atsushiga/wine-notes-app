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
        <div className="rounded-lg border border-red-200 bg-red-50 p-5">
            <h2 className="text-base font-semibold text-red-900">退会とデータ削除</h2>
            <p className="mt-2 text-sm leading-6 text-red-800">
                退会すると、プロフィール、テイスティング記録、画像、AI解説履歴を削除します。この操作は取り消せません。
            </p>
            <label htmlFor="delete-confirm" className="mt-4 block text-sm font-medium text-red-900">
                確認のため DELETE と入力
            </label>
            <input
                id="delete-confirm"
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                className="mt-2 w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-400"
                autoComplete="off"
            />
            {message && (
                <p className="mt-3 text-sm text-red-700" role="alert">
                    {message}
                </p>
            )}
            <button
                type="button"
                onClick={handleDelete}
                disabled={!canDelete || isPending}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
                {isPending ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                アカウントを削除する
            </button>
        </div>
    );
}

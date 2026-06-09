import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordRequestForm } from "./ResetPasswordRequestForm";

export const metadata: Metadata = {
  title: "パスワード再設定",
};

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center px-4">
      <h1 className="text-xl font-semibold text-[var(--text)]">パスワード再設定</h1>
      <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
        登録済みのメールアドレスを入力してください。パスワード再設定用のリンクを送信します。
      </p>
      <ResetPasswordRequestForm />
      <p className="mt-4 text-center text-sm text-[var(--text-muted)]">
        <Link href="/login" className="underline hover:no-underline">
          ログインに戻る
        </Link>
      </p>
    </main>
  );
}

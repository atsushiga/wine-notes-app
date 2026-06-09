import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { UpdatePasswordForm } from "../UpdatePasswordForm";

export const metadata: Metadata = {
  title: "新しいパスワードを設定",
};

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center px-4">
      <h1 className="text-xl font-semibold text-[var(--text)]">新しいパスワードを設定</h1>
      <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
        10文字以上の新しいパスワードを入力してください。
      </p>
      <UpdatePasswordForm />
    </main>
  );
}

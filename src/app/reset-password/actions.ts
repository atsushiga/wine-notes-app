"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";

const MIN_PASSWORD_LENGTH = 10;

export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { error: "有効なメールアドレスを入力してください。" };
  }

  const headerStore = await headers();
  const origin = headerStore.get("origin") || headerStore.get("referer")?.replace(/\/reset-password.*$/, "");
  const baseUrl = origin || process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_BASE_URL;
  if (!baseUrl) {
    return { error: "パスワード再設定URLを生成できませんでした。" };
  }

  const supabase = await createClient();
  const redirectTo = `${baseUrl}/auth/callback?next=/reset-password/update`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    return { error: error.message };
  }

  return { message: "パスワード再設定メールを送信しました。メール内のリンクから変更してください。" };
}

export async function updatePasswordAfterResetAction(formData: FormData) {
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: "パスワードは10文字以上で入力してください。" };
  }

  if (password !== confirm) {
    return { error: "パスワードが一致しません。" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }

  redirect("/");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function signOut() {
    const supabase = await createClient();
    await supabase.auth.signOut();
    revalidatePath("/", "layout");
    redirect("/login");
}

export async function updateProfile(formData: FormData) {
    const supabase = await createClient();
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const updates: { email?: string; password?: string } = {};

    if (email) updates.email = email;
    if (password) updates.password = password;

    const { error } = await supabase.auth.updateUser(updates);

    if (error) {
        return { error: error.message };
    }

    revalidatePath("/settings");

    if (email && !password) {
        return { message: "確認メールを送信しました。メール内のリンクをクリックして変更を完了してください。" };
    }

    return { message: "プロフィールを更新しました。" };
}

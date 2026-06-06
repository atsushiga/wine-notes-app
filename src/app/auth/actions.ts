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

function isMissingProfilePreferenceColumn(error: { code?: string; message?: string }) {
    return error.code === "PGRST204" ||
        !!error.message?.includes("default_input_mode") ||
        !!error.message?.includes("simple_auto_image_optimize") ||
        !!error.message?.includes("simple_auto_wine_name_search") ||
        !!error.message?.includes("simple_auto_ai_info");
}

function formBoolean(value: FormDataEntryValue | null, fallback = true) {
    if (value === null) return fallback;
    return value === "true";
}

export async function updateProfile(formData: FormData) {
    const supabase = await createClient();
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        return { error: "ログインが必要です。" };
    }

    const email = ((formData.get("email") as string) || "").trim();
    const password = ((formData.get("password") as string) || "").trim();
    const defaultInputModeValue = formData.get("defaultInputMode");
    const defaultInputMode = defaultInputModeValue === "detailed" ? "detailed" : "simple";
    const simpleAutoImageOptimize = formBoolean(formData.get("simpleAutoImageOptimize"));
    const simpleAutoWineNameSearch = formBoolean(formData.get("simpleAutoWineNameSearch"));
    const simpleAutoAiInfo = simpleAutoWineNameSearch && formBoolean(formData.get("simpleAutoAiInfo"));

    const updates: { email?: string; password?: string } = {};

    if (email && email !== user.email) updates.email = email;
    if (password) updates.password = password;

    if (Object.keys(updates).length > 0) {
        const { error } = await supabase.auth.updateUser(updates);

        if (error) {
            return { error: error.message };
        }
    }

    const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
            id: user.id,
            default_input_mode: defaultInputMode,
            simple_auto_image_optimize: simpleAutoImageOptimize,
            simple_auto_wine_name_search: simpleAutoWineNameSearch,
            simple_auto_ai_info: simpleAutoAiInfo,
            updated_at: new Date().toISOString(),
        }, { onConflict: "id" });

    if (profileError) {
        if (isMissingProfilePreferenceColumn(profileError)) {
            return { error: "profiles の設定カラムがDBに未反映です。Supabaseのマイグレーションを適用してからもう一度保存してください。" };
        }

        return { error: profileError.message };
    }

    revalidatePath("/settings");
    revalidatePath("/");

    if (updates.email && !updates.password) {
        return { message: "確認メールを送信しました。メール内のリンクをクリックして変更を完了してください。" };
    }

    return { message: "設定を更新しました。" };
}

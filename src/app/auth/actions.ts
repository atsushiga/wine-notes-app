"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { storage, BUCKET } from "@/lib/gcs";

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
        const requestHeaders = await headers();
        const origin = requestHeaders.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "";
        const { error } = await supabase.auth.updateUser(
            updates,
            updates.email && origin ? { emailRedirectTo: `${origin}/auth/callback?next=/settings` } : undefined,
        );

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

    if (updates.email) {
        return { message: `確認メールを ${updates.email} に送信しました。メール内のリンクをクリックして変更を完了してください。` };
    }

    return { message: "設定を更新しました。" };
}

function imageUrlToKey(value: string) {
    const marker = "/api/images/";
    const markerIndex = value.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(value.slice(markerIndex + marker.length).split(/[?#]/)[0]);
}

function collectImageKeys(value: unknown, keys = new Set<string>()) {
    if (typeof value === "string") {
        const key = imageUrlToKey(value);
        if (key) keys.add(key);
        return keys;
    }

    if (Array.isArray(value)) {
        value.forEach((item) => collectImageKeys(item, keys));
        return keys;
    }

    if (value && typeof value === "object") {
        Object.values(value as Record<string, unknown>).forEach((item) => collectImageKeys(item, keys));
    }

    return keys;
}

async function deleteGcsObject(key: string) {
    try {
        await storage.bucket(BUCKET).file(key).delete({ ignoreNotFound: true });
    } catch (error) {
        console.error("Failed to delete GCS object during account deletion:", { key, error });
    }
}

export async function deleteAccount() {
    const supabase = await createClient();
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        return { error: "ログインが必要です。" };
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
        return { error: "退会処理の環境変数が不足しています。" };
    }

    const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });

    const imageKeys = new Set<string>();
    const { data: notes, error: notesError } = await admin
        .from("tasting_notes")
        .select("id,image_url")
        .eq("user_id", user.id);

    if (notesError) {
        return { error: notesError.message };
    }

    const noteIds = (notes || []).map((note) => note.id).filter((id) => id != null);
    for (const note of notes || []) {
        collectImageKeys(note.image_url, imageKeys);
    }

    if (noteIds.length > 0) {
        const { data: wineImages, error: imagesError } = await admin
            .from("wine_images")
            .select("url,thumbnail_url,storage_path")
            .in("tasting_note_id", noteIds);

        if (imagesError) {
            return { error: imagesError.message };
        }

        for (const image of wineImages || []) {
            collectImageKeys(image.url, imageKeys);
            collectImageKeys(image.thumbnail_url, imageKeys);
            if (image.storage_path) imageKeys.add(image.storage_path);
        }
    }

    const { data: aiExplanations, error: aiError } = await admin
        .from("ai_explanations")
        .select("image_url,input,explanation")
        .eq("user_id", user.id);

    if (aiError) {
        return { error: aiError.message };
    }

    for (const explanation of aiExplanations || []) {
        collectImageKeys(explanation, imageKeys);
    }

    await Promise.all(Array.from(imageKeys).map(deleteGcsObject));

    if (noteIds.length > 0) {
        const { error: wineImageDeleteError } = await admin
            .from("wine_images")
            .delete()
            .in("tasting_note_id", noteIds);

        if (wineImageDeleteError) {
            return { error: wineImageDeleteError.message };
        }
    }

    const { error: aiDeleteError } = await admin
        .from("ai_explanations")
        .delete()
        .eq("user_id", user.id);

    if (aiDeleteError) {
        return { error: aiDeleteError.message };
    }

    const { error: notesDeleteError } = await admin
        .from("tasting_notes")
        .delete()
        .eq("user_id", user.id);

    if (notesDeleteError) {
        return { error: notesDeleteError.message };
    }

    const { error: profileDeleteError } = await admin
        .from("profiles")
        .delete()
        .eq("id", user.id);

    if (profileDeleteError) {
        return { error: profileDeleteError.message };
    }

    const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteUserError) {
        return { error: deleteUserError.message };
    }

    await supabase.auth.signOut();
    revalidatePath("/", "layout");
    redirect("/login?deleted=1");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

const INVALID_CREDENTIALS_ERROR = "invalid_credentials";
const AUTH_UNAVAILABLE_ERROR = "auth_unavailable";

function redirectToLoginError(error: string): never {
    redirect(`/login?error=${error}`);
}

export async function login(formData: FormData) {
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");

    if (!email || !password) {
        redirectToLoginError(INVALID_CREDENTIALS_ERROR);
    }

    let signInError: { message?: string; status?: number } | null = null;

    try {
        const supabase = await createClient();
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        signInError = error;
    } catch (error) {
        console.error("Unexpected login error:", error);
        redirectToLoginError(AUTH_UNAVAILABLE_ERROR);
    }

    if (signInError) {
        const isInvalidCredentials =
            signInError.status === 400 ||
            signInError.message?.toLowerCase().includes("invalid login credentials");

        redirectToLoginError(isInvalidCredentials ? INVALID_CREDENTIALS_ERROR : AUTH_UNAVAILABLE_ERROR);
    }

    revalidatePath("/", "layout");
    redirect("/");
}

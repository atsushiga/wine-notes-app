import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import ProfileForm from "@/components/settings/profile-form";
import LogoutButton from "@/components/settings/logout-button";

export default async function SettingsPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("default_input_mode")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
        console.warn("default_input_mode is not available; falling back to simple mode.", profileError.message);
    }

    const defaultInputMode = !profileError && profile?.default_input_mode === "detailed" ? "detailed" : "simple";

    return (
        <div className="container mx-auto px-4 py-8 pb-32 max-w-md">
            <h1 className="text-2xl font-bold mb-6 text-gray-900">設定</h1>

            <div className="space-y-6">
                <ProfileForm user={user} defaultInputMode={defaultInputMode} />

                <div className="mt-8 pt-6 border-t border-gray-100">
                    <LogoutButton />
                </div>
            </div>
        </div>
    );
}

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

    return (
        <div className="container mx-auto px-4 py-8 pb-32 max-w-md">
            <h1 className="text-2xl font-bold mb-6 text-gray-900">設定</h1>

            <div className="space-y-6">
                <ProfileForm user={user} />

                <div className="mt-8 pt-6 border-t border-gray-100">
                    <LogoutButton />
                </div>
            </div>
        </div>
    );
}

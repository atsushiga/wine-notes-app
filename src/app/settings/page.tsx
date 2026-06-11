import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ProfileForm from "@/components/settings/profile-form";
import LogoutButton from "@/components/settings/logout-button";
import DeleteAccountSection from "@/components/settings/delete-account-section";
import DataExportSection from "@/components/settings/data-export-section";
import { defaultSimpleAiAutomationSettings, type SimpleAiAutomationSettings } from "@/lib/simpleAiAutomation";

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
        .select("default_input_mode, simple_auto_image_optimize, simple_auto_wine_name_search, simple_auto_ai_info")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
        console.warn("profile preferences are not available; falling back to defaults.", profileError.message);
    }

    const defaultInputMode = !profileError && profile?.default_input_mode === "detailed" ? "detailed" : "simple";
    const wineNameSearch = !profileError && profile ? profile.simple_auto_wine_name_search !== false : defaultSimpleAiAutomationSettings.wineNameSearch;
    const simpleAiAutomation: SimpleAiAutomationSettings = !profileError && profile ? {
        imageOptimize: profile.simple_auto_image_optimize !== false,
        wineNameSearch,
        aiInfo: wineNameSearch && profile.simple_auto_ai_info !== false,
    } : defaultSimpleAiAutomationSettings;

    return (
        <div className="container mx-auto px-4 py-8 pb-32 max-w-md">
            <h1 className="text-2xl font-bold mb-6 text-gray-900">設定</h1>

            <div className="space-y-6">
                <ProfileForm user={user} defaultInputMode={defaultInputMode} simpleAiAutomation={simpleAiAutomation} />

                <DataExportSection />

                <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
                    <h2 className="text-base font-semibold text-gray-900">サポートとポリシー</h2>
                    <div className="mt-3 grid gap-2 text-sm">
                        <Link href="/terms" className="text-gray-700 underline underline-offset-4 hover:text-rose-700">
                            利用規約
                        </Link>
                        <Link href="/privacy" className="text-gray-700 underline underline-offset-4 hover:text-rose-700">
                            プライバシーポリシー
                        </Link>
                        <Link href="/contact" className="text-gray-700 underline underline-offset-4 hover:text-rose-700">
                            問い合わせ
                        </Link>
                    </div>
                </div>

                <DeleteAccountSection />

                <div className="mt-8 pt-6 border-t border-gray-100">
                    <LogoutButton />
                </div>
            </div>
        </div>
    );
}

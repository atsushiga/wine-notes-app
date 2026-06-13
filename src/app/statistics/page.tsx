
import { createClient } from "@/utils/supabase/server";
import { TastingNote } from "@/types/custom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { EmptyState } from "@/components/ui/primitives";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StatisticsPage() {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
        console.error("Auth error:", authError);
    }

    if (!user) {
        redirect("/login");
    }

    // Build query
    let query = supabase
        .from("tasting_notes")
        .select("*")
        .order("created_at", { ascending: false });

    query = query.eq("user_id", user.id);

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching tasting notes for stats:", {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            fullError: JSON.stringify(error, null, 2)
        });
        return (
            <div className="mx-auto max-w-3xl px-4 py-16 pb-32">
                <EmptyState
                    icon={<AlertTriangle size={24} />}
                    title="統計データの取得に失敗しました"
                    description={error.message || '不明なエラーが発生しました。時間をおいてもう一度お試しください。'}
                />
            </div>
        );
    }

    const notes = (data as unknown as TastingNote[]) || [];

    return (
        <DashboardLayout notes={notes} />
    );
}

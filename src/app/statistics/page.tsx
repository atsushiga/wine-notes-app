
import { createClient } from "@/utils/supabase/server";
import { TastingNote } from "@/types/custom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";

export const dynamic = "force-dynamic";

export default async function StatisticsPage() {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
        console.error("Auth error:", authError);
    }

    // Build query
    let query = supabase
        .from("tasting_notes")
        .select("*")
        .order("created_at", { ascending: false });

    // Filter by user_id if authenticated
    if (user) {
        query = query.eq("user_id", user.id);
    }

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
            <div className="p-8 text-center text-red-600">
                <p>データの取得に失敗しました。</p>
                <p className="text-sm mt-2 text-gray-500">{error.message || '不明なエラーが発生しました'}</p>
                {error.details && (
                    <p className="text-xs mt-1 text-gray-400">{error.details}</p>
                )}
            </div>
        );
    }

    const notes = (data as unknown as TastingNote[]) || [];

    return (
        <DashboardLayout notes={notes} />
    );
}


import { createClient } from "@/utils/supabase/server";
import { TastingNote } from "@/types/custom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";

export const dynamic = "force-dynamic";

export default async function StatisticsPage() {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("tasting_notes")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching tasting notes for stats:", error);
        return (
            <div className="p-8 text-center text-red-600">
                <p>データの取得に失敗しました。</p>
                <p className="text-sm mt-2 text-gray-500">{error.message}</p>
            </div>
        );
    }

    const notes = (data as unknown as TastingNote[]) || [];

    return (
        <DashboardLayout notes={notes} />
    );
}

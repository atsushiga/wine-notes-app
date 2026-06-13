import { createClient } from "@/utils/supabase/server";
import { TastingNote } from "@/types/custom";
import WineList from "@/components/WineList";
import { EmptyState } from "@/components/ui/primitives";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Plus, Wine } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TastingNotesPage() {
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
        .select("*, images:wine_images(*)")
        .order("date", { ascending: false });

    query = query.eq("user_id", user.id);

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching tasting notes:", {
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
                    title="データの取得に失敗しました"
                    description={error.message || '不明なエラーが発生しました。時間をおいてもう一度お試しください。'}
                />
            </div>
        );
    }

    const notes = (data as unknown as TastingNote[]) || [];

    if (notes.length === 0) {
        return (
            <div className="mx-auto max-w-3xl px-4 py-16 pb-32">
                <EmptyState
                    icon={<Wine size={24} />}
                    title="まだ記録がありません"
                    description="最初のワインを登録すると、ラベル画像、テイスティングメモ、AI分析をここから振り返れます。"
                    action={
                        <Link
                            href="/"
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                        >
                            <Plus size={16} />
                            記録を追加
                        </Link>
                    }
                />
            </div>
        );
    }


    return (
        <WineList notes={notes} />
    );
}

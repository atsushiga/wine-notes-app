import { createClient } from "@/utils/supabase/server";
import { TastingNote } from "@/types/custom";
import Image from "next/image";
import Link from "next/link";
import WineList from "@/components/WineList";

export const dynamic = "force-dynamic";

export default async function TastingNotesPage() {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("tasting_notes")
        .select("*, images:wine_images(url, thumbnail_url, display_order)")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching tasting notes:", error);
        return (
            <div className="p-8 text-center text-red-600">
                <p>データの取得に失敗しました。</p>
                <p className="text-sm mt-2 text-gray-500">{error.message}</p>
            </div>
        );
    }

    const notes = (data as unknown as TastingNote[]) || [];

    if (notes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <svg
                        className="w-12 h-12 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                        />
                    </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">
                    まだ記録がありません
                </h2>
                <p className="text-gray-500 max-w-sm">
                    新しいワインを飲んで、感想を記録してみましょう。
                </p>
            </div>
        );
    }


    return (
        <WineList notes={notes} />
    );
}

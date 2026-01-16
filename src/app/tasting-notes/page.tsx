import { createClient } from "@/utils/supabase/server";
import { TastingNote } from "@/types/custom";
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TastingNotesPage() {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("tasting_notes")
        .select("*")
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
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900 px-2 pt-2">
                ワイン記録一覧
            </h1>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                {notes.map((note) => (
                    <Link
                        href={`/wines/${note.id}`}
                        key={note.id}
                        className="block h-full group"
                    >
                        <div
                            className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 flex flex-col h-full transition-transform duration-200 group-hover:-translate-y-1 group-hover:shadow-md"
                        >
                            {/* 
                              aspect-[3/4] (0.75) -> 80% height = aspect-[3/3.2] (0.9375)
                              Using aspect-[3/3.2] via arbitrary value to match request precisely.
                              Or aspect-[15/16] which is close to square.
                            */}
                            <div className="relative aspect-[3/3.2] w-full bg-gray-100">
                                {note.image_url ? (
                                    <Image
                                        src={note.image_url}
                                        alt={note.wine_name || "Wine Image"}
                                        fill
                                        className="object-cover"
                                        sizes="(max-width: 768px) 50vw, 33vw"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-gray-300">
                                        <span className="text-4xl">🍷</span>
                                    </div>
                                )}
                                {note.rating && (
                                    <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full shadow-sm flex items-center space-x-1">
                                        <span className="text-yellow-500 text-xs">★</span>
                                        <span className="text-xs font-bold text-gray-800">
                                            {note.rating}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="p-3 flex flex-col flex-grow">
                                <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 mb-1 group-hover:text-[var(--accent)] transition-colors">
                                    {note.wine_name || "名称未設定"}
                                </h3>

                                {note.vintage && (
                                    <p className="text-xs text-gray-500 mb-2">{note.vintage}</p>
                                )}

                                <div className="mt-auto pt-2 border-t border-gray-50 flex justify-between items-center text-[10px] text-gray-400">
                                    <span suppressHydrationWarning>
                                        {new Date(note.created_at).toLocaleDateString("ja-JP")}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}

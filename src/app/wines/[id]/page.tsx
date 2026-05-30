
import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import { TastingNote } from "@/types/custom";
import WineDetailClient from "./WineDetailClient";

export const dynamic = "force-dynamic";

interface Props {
    params: Promise<{ id: string }>;
}

export default async function WineDetailPage({ params }: Props) {
    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("tasting_notes")
        .select("*, images:wine_images(*)")
        .eq("id", id)
        .single();

    if (error || !data) {
        // Suppress "No rows found" error log for cleaner UX on delete/redirect
        if (error && error.code !== 'PGRST116') {
            console.error("Error fetching wine:", error);
        }
        notFound();
    }

    let wine = data as TastingNote;

    // Manual fetch for locality_vocab since FK relation might be missing or unnamed
    if (wine.locality_vocab_id) {
        const { data: vocab } = await supabase
            .from('geo_vocab')
            .select('name, name_ja')
            .eq('id', wine.locality_vocab_id)
            .single();

        if (vocab) {
            wine = {
                ...wine,
                locality_vocab: {
                    name: vocab.name,
                    name_ja: vocab.name_ja ?? undefined,
                },
            };
        }
    }

    return <WineDetailClient wine={wine} />;
}

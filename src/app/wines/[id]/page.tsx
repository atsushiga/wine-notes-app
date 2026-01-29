
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

    // Manual fetch for locality_vocab since FK relation might be missing or unnamed
    if (data.locality_vocab_id) {
        const { data: vocab } = await supabase
            .from('geo_vocab')
            .select('name, name_ja')
            .eq('id', data.locality_vocab_id)
            .single();

        if (vocab) {
            // Attach to data object to match TastingNote type
            (data as any).locality_vocab = vocab;
        }
    }

    const wine = data as TastingNote;

    return <WineDetailClient wine={wine} />;
}

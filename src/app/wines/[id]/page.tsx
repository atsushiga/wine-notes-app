
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

    const wine = data as TastingNote;

    return <WineDetailClient wine={wine} />;
}

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { requireAuthenticatedUser } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireAuthenticatedUser();
  const supabase = await createClient();

  const [profileResult, notesResult, aiResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("tasting_notes")
      .select("*, images:wine_images(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("ai_explanations")
      .select("*")
      .eq("user_id", user.id)
      .order("generated_at", { ascending: false }),
  ]);

  const firstError = profileResult.error || notesResult.error || aiResult.error;
  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  const exportedAt = new Date().toISOString();
  const payload = {
    exportedAt,
    user: {
      id: user.id,
      email: user.email,
    },
    profile: profileResult.data,
    tastingNotes: notesResult.data || [],
    aiExplanations: aiResult.data || [],
  };

  const filenameDate = exportedAt.slice(0, 10);
  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="wine-notes-export-${filenameDate}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

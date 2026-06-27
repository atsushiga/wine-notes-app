import { NextRequest, NextResponse } from "next/server";
import { apiTokenErrorResponse, requireApiToken } from "@/lib/apiTokens";
import { getSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiToken(request, "notes:read", {
      endpoint: "/api/v1/export",
    });
    const supabase = getSupabaseClient();

    const [profileResult, notesResult, aiResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("id", auth.userId)
        .maybeSingle(),
      supabase
        .from("tasting_notes")
        .select("*, images:wine_images(*)")
        .eq("user_id", auth.userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("ai_explanations")
        .select("*")
        .eq("user_id", auth.userId)
        .order("generated_at", { ascending: false }),
    ]);

    const firstError = profileResult.error || notesResult.error || aiResult.error;
    if (firstError) {
      return NextResponse.json(
        { error: { code: "export_failed", message: firstError.message } },
        { status: 500 },
      );
    }

    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      profile: profileResult.data,
      tastingNotes: notesResult.data || [],
      aiExplanations: aiResult.data || [],
    }, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const tokenError = apiTokenErrorResponse(error);
    if (tokenError) return tokenError;

    console.error("Read-only export API failed:", error);
    return NextResponse.json(
      { error: { code: "export_failed", message: "Failed to export data" } },
      { status: 500 },
    );
  }
}

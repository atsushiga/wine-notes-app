import { NextRequest, NextResponse } from "next/server";
import { apiTokenErrorResponse, requireApiToken } from "@/lib/apiTokens";
import { getSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseNoteId(value: string) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: rawId } = await context.params;
    const id = parseNoteId(rawId);
    if (!id) {
      return NextResponse.json(
        { error: { code: "invalid_note_id", message: "Invalid tasting note id" } },
        { status: 400 },
      );
    }

    const auth = await requireApiToken(request, "notes:read", {
      endpoint: "/api/v1/tasting-notes/[id]",
      noteId: id,
    });
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("tasting_notes")
      .select("*, images:wine_images(*)")
      .eq("id", id)
      .eq("user_id", auth.userId)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: { code: "note_lookup_failed", message: error.message } },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Tasting note not found" } },
        { status: 404 },
      );
    }

    let note = data;
    if (note.locality_vocab_id) {
      const { data: vocab, error: vocabError } = await supabase
        .from("geo_vocab")
        .select("name, name_ja")
        .eq("id", note.locality_vocab_id)
        .maybeSingle();

      if (vocabError) {
        console.warn("Locality vocab lookup failed for API response.", vocabError.message);
      } else if (vocab) {
        note = {
          ...note,
          locality_vocab: {
            name: vocab.name,
            name_ja: vocab.name_ja,
          },
        };
      }
    }

    return NextResponse.json({ data: note }, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const tokenError = apiTokenErrorResponse(error);
    if (tokenError) return tokenError;

    console.error("Read-only tasting note detail API failed:", error);
    return NextResponse.json(
      { error: { code: "note_lookup_failed", message: "Failed to fetch tasting note" } },
      { status: 500 },
    );
  }
}

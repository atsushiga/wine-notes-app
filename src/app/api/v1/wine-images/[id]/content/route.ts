import { NextRequest, NextResponse } from "next/server";
import { apiTokenErrorResponse, requireApiToken } from "@/lib/apiTokens";
import { BUCKET, storage } from "@/lib/gcs";
import { getSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WineImageRow = {
  id: string;
  tasting_note_id: number;
  url: string | null;
  storage_path: string | null;
};

type GcsMeta = {
  contentType?: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function imageStorageKey(image: WineImageRow) {
  if (image.storage_path) return image.storage_path;
  if (!image.url) return null;

  const marker = "/api/images/";
  const markerIndex = image.url.indexOf(marker);
  if (markerIndex < 0) return null;

  try {
    return decodeURIComponent(image.url.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json(
        { error: { code: "invalid_image_id", message: "Invalid wine image id" } },
        { status: 400 },
      );
    }

    const auth = await requireApiToken(request, "images:read", {
      endpoint: "/api/v1/wine-images/[id]/content",
      imageId: id,
    });
    const supabase = getSupabaseClient();

    const { data: image, error: imageError } = await supabase
      .from("wine_images")
      .select("id, tasting_note_id, url, storage_path")
      .eq("id", id)
      .maybeSingle();

    if (imageError) {
      return NextResponse.json(
        { error: { code: "image_lookup_failed", message: imageError.message } },
        { status: 500 },
      );
    }

    if (!image) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Wine image not found" } },
        { status: 404 },
      );
    }

    const { data: note, error: noteError } = await supabase
      .from("tasting_notes")
      .select("id")
      .eq("id", (image as WineImageRow).tasting_note_id)
      .eq("user_id", auth.userId)
      .maybeSingle();

    if (noteError) {
      return NextResponse.json(
        { error: { code: "image_owner_lookup_failed", message: noteError.message } },
        { status: 500 },
      );
    }

    if (!note) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Wine image not found" } },
        { status: 404 },
      );
    }

    const key = imageStorageKey(image as WineImageRow);
    if (!key || key.includes("..")) {
      return NextResponse.json(
        { error: { code: "image_content_unavailable", message: "Wine image content is unavailable" } },
        { status: 404 },
      );
    }

    const file = storage.bucket(BUCKET).file(key);
    let meta: GcsMeta = { contentType: "application/octet-stream" };
    try {
      const [metadata] = await file.getMetadata();
      meta = { contentType: metadata.contentType };
    } catch {
      /* fallback content type is used below */
    }

    const [contents] = await file.download();

    return new Response(new Uint8Array(contents), {
      status: 200,
      headers: {
        "Content-Type": meta.contentType ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    const tokenError = apiTokenErrorResponse(error);
    if (tokenError) return tokenError;

    console.error("Read-only wine image content API failed:", error);
    return NextResponse.json(
      { error: { code: "image_content_failed", message: "Failed to fetch wine image content" } },
      { status: 500 },
    );
  }
}

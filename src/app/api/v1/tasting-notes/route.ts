import { NextRequest, NextResponse } from "next/server";
import { apiTokenErrorResponse, requireApiToken } from "@/lib/apiTokens";
import { getSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Cursor = {
  offset: number;
};

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;
const STATUS_VALUES = new Set(["all", "draft", "published"]);

function parseLimit(value: string | null) {
  const parsed = Number(value || DEFAULT_LIMIT);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(parsed)));
}

function parseCursor(value: string | null) {
  if (!value) return 0;

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Cursor;
    if (Number.isSafeInteger(parsed.offset) && parsed.offset >= 0) {
      return parsed.offset;
    }
  } catch {
    return null;
  }

  return null;
}

function encodeCursor(offset: number) {
  return Buffer.from(JSON.stringify({ offset }), "utf8").toString("base64url");
}

function parseInclude(value: string | null) {
  if (!value) return { includeImages: false };

  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.some((part) => part !== "images")) return null;

  return { includeImages: parts.includes("images") };
}

function parseUpdatedAfter(value: string | null) {
  if (!value) return null;

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return undefined;

  return new Date(timestamp).toISOString();
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiToken(request, "notes:read", {
      endpoint: "/api/v1/tasting-notes",
    });
    const params = request.nextUrl.searchParams;
    const limit = parseLimit(params.get("limit"));
    const offset = parseCursor(params.get("cursor"));
    const include = parseInclude(params.get("include"));
    const status = params.get("status") || "all";
    const updatedAfter = parseUpdatedAfter(params.get("updated_after"));

    if (offset === null) {
      return NextResponse.json(
        { error: { code: "invalid_cursor", message: "Invalid cursor" } },
        { status: 400 },
      );
    }

    if (!include) {
      return NextResponse.json(
        { error: { code: "invalid_include", message: "Unsupported include value" } },
        { status: 400 },
      );
    }

    if (!STATUS_VALUES.has(status)) {
      return NextResponse.json(
        { error: { code: "invalid_status", message: "Unsupported status value" } },
        { status: 400 },
      );
    }

    if (updatedAfter === undefined) {
      return NextResponse.json(
        { error: { code: "invalid_updated_after", message: "Invalid updated_after value" } },
        { status: 400 },
      );
    }

    const supabase = getSupabaseClient();
    let query = supabase
      .from("tasting_notes")
      .select(include.includeImages ? "*, images:wine_images(*)" : "*")
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit);

    if (status !== "all") {
      query = query.eq("status", status);
    }

    if (updatedAfter) {
      query = query.gt("updated_at", updatedAfter);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { error: { code: "notes_lookup_failed", message: error.message } },
        { status: 500 },
      );
    }

    const rows = data || [];
    const hasMore = rows.length > limit;

    return NextResponse.json({
      data: rows.slice(0, limit),
      pagination: {
        nextCursor: hasMore ? encodeCursor(offset + limit) : null,
        hasMore,
      },
    }, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const tokenError = apiTokenErrorResponse(error);
    if (tokenError) return tokenError;

    console.error("Read-only tasting notes API failed:", error);
    return NextResponse.json(
      { error: { code: "notes_lookup_failed", message: "Failed to fetch tasting notes" } },
      { status: 500 },
    );
  }
}

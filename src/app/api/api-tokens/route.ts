import { NextRequest, NextResponse } from "next/server";
import {
  apiTokenErrorResponse,
  createApiToken,
  isApiTokenScope,
  normalizeApiTokenScopes,
  serializeApiTokenRow,
  type ApiTokenScope,
} from "@/lib/apiTokens";
import { requireAuthenticatedUser, isAuthenticationRequiredError } from "@/lib/serverAuth";
import { getSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateApiTokenBody = {
  name?: unknown;
  scopes?: unknown;
  expiresAt?: unknown;
};

function parseTokenName(value: unknown) {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (name.length < 1 || name.length > 80) return null;
  return name;
}

function parseScopes(value: unknown): ApiTokenScope[] | null {
  if (value == null) return ["notes:read"];
  if (!Array.isArray(value) || value.length === 0) return null;
  if (!value.every(isApiTokenScope)) return null;
  return normalizeApiTokenScopes(value);
}

function parseExpiresAt(value: unknown) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return undefined;

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp <= Date.now()) {
    return undefined;
  }

  return new Date(timestamp).toISOString();
}

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("api_tokens")
      .select("id, name, token_id, token_prefix, scopes, expires_at, revoked_at, last_used_at, created_at")
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { ok: false, error: "api_token_list_failed", message: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      tokens: (data || []).map((row) => serializeApiTokenRow(row)),
    });
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return NextResponse.json({ ok: false, error: "authentication_required" }, { status: 401 });
    }

    const tokenError = apiTokenErrorResponse(error);
    if (tokenError) return tokenError;

    console.error("API token list failed:", error);
    return NextResponse.json({ ok: false, error: "api_token_list_failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();

    let body: CreateApiTokenBody;
    try {
      body = (await request.json()) as CreateApiTokenBody;
    } catch {
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    const name = parseTokenName(body.name);
    if (!name) {
      return NextResponse.json({ ok: false, error: "invalid_name" }, { status: 400 });
    }

    const scopes = parseScopes(body.scopes);
    if (!scopes) {
      return NextResponse.json({ ok: false, error: "invalid_scopes" }, { status: 400 });
    }

    const expiresAt = parseExpiresAt(body.expiresAt);
    if (expiresAt === undefined) {
      return NextResponse.json({ ok: false, error: "invalid_expires_at" }, { status: 400 });
    }

    const generated = createApiToken();
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("api_tokens")
      .insert({
        user_id: user.id,
        name,
        token_id: generated.tokenId,
        token_hash: generated.tokenHash,
        token_prefix: generated.tokenPrefix,
        scopes,
        expires_at: expiresAt,
      })
      .select("id, name, token_id, token_prefix, scopes, expires_at, revoked_at, last_used_at, created_at")
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: "api_token_create_failed", message: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      token: generated.token,
      tokenInfo: serializeApiTokenRow(data),
    }, { status: 201 });
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return NextResponse.json({ ok: false, error: "authentication_required" }, { status: 401 });
    }

    const tokenError = apiTokenErrorResponse(error);
    if (tokenError) return tokenError;

    console.error("API token create failed:", error);
    return NextResponse.json({ ok: false, error: "api_token_create_failed" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { isAuthenticationRequiredError, requireAuthenticatedUser } from "@/lib/serverAuth";
import { getSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuthenticatedUser();
    const { id } = await context.params;

    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json({ ok: false, error: "invalid_token_id" }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("api_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { ok: false, error: "api_token_revoke_failed", message: error.message },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json({ ok: false, error: "api_token_not_found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return NextResponse.json({ ok: false, error: "authentication_required" }, { status: 401 });
    }

    console.error("API token revoke failed:", error);
    return NextResponse.json({ ok: false, error: "api_token_revoke_failed" }, { status: 500 });
  }
}

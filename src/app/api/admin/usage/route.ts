import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser, adminAuthErrorResponse } from "@/lib/adminAuth";
import { getSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UsageEventRow = {
  action: string | null;
  quantity: number | null;
  user_id: string | null;
  subject_key: string | null;
  created_at: string | null;
};

const TABLES_TO_COUNT = [
  "profiles",
  "tasting_notes",
  "wine_images",
  "ai_explanations",
  "usage_events",
] as const;

function parseDays(value: string | null) {
  const parsed = Number(value || 7);
  if (!Number.isFinite(parsed)) return 7;
  return Math.min(30, Math.max(1, Math.floor(parsed)));
}

function summarizeUsage(rows: UsageEventRow[]) {
  const actionMap = new Map<string, { action: string; events: number; quantity: number; last24hQuantity: number }>();
  const userMap = new Map<string, { userId: string; events: number; quantity: number }>();
  const last24h = Date.now() - 24 * 60 * 60 * 1000;

  for (const row of rows) {
    const action = row.action || "unknown";
    const quantity = Number(row.quantity || 0);
    const createdAt = row.created_at ? Date.parse(row.created_at) : 0;
    const actionSummary = actionMap.get(action) || { action, events: 0, quantity: 0, last24hQuantity: 0 };

    actionSummary.events += 1;
    actionSummary.quantity += quantity;
    if (createdAt >= last24h) {
      actionSummary.last24hQuantity += quantity;
    }
    actionMap.set(action, actionSummary);

    if (row.user_id) {
      const userSummary = userMap.get(row.user_id) || { userId: row.user_id, events: 0, quantity: 0 };
      userSummary.events += 1;
      userSummary.quantity += quantity;
      userMap.set(row.user_id, userSummary);
    }
  }

  return {
    byAction: Array.from(actionMap.values()).sort((a, b) => b.quantity - a.quantity),
    topUsers: Array.from(userMap.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 20),
  };
}

async function getTableCounts() {
  const supabase = getSupabaseClient();
  const results = await Promise.all(
    TABLES_TO_COUNT.map(async (table) => {
      const { count, error } = await supabase
        .from(table)
        .select("id", { count: "exact", head: true });

      return {
        table,
        count: count ?? null,
        error: error?.message,
      };
    }),
  );

  return results;
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdminUser();
    const days = parseDays(request.nextUrl.searchParams.get("days"));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const supabase = getSupabaseClient();

    const [{ data, error }, tableCounts] = await Promise.all([
      supabase
        .from("usage_events")
        .select("action, quantity, user_id, subject_key, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000),
      getTableCounts(),
    ]);

    if (error) {
      return NextResponse.json(
        { ok: false, error: "usage_lookup_failed", message: error.message },
        { status: 500 },
      );
    }

    const rows = (data || []) as UsageEventRow[];
    const summary = summarizeUsage(rows);

    return NextResponse.json({
      ok: true,
      checkedAt: new Date().toISOString(),
      window: {
        days,
        since,
        maxEventsLoaded: 5000,
      },
      admin: {
        id: admin.id,
        email: admin.email,
      },
      totals: {
        usageEventsLoaded: rows.length,
        tableCounts,
      },
      usage: summary,
      recentEvents: rows.slice(0, 50).map((row) => ({
        action: row.action,
        quantity: row.quantity,
        userId: row.user_id,
        subjectKey: row.subject_key,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    const authError = adminAuthErrorResponse(error);
    if (authError) {
      return NextResponse.json(authError.body, { status: authError.status });
    }

    console.error("Admin usage endpoint failed:", error);
    return NextResponse.json({ ok: false, error: "admin_usage_failed" }, { status: 500 });
  }
}

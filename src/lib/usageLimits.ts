import { createHash } from "node:crypto";
import { getSupabaseClient } from "@/lib/supabase";

export type UsageAction =
  | "ai_deep_search"
  | "ai_image_optimize"
  | "ai_label_analysis"
  | "ai_transcript_interpretation"
  | "ai_visual_explanation"
  | "ai_visual_images"
  | "image_upload"
  | "signup_email"
  | "stt"
  | "wine_submit";

type UsageLimit = {
  dailyLimit: number;
};

type UsageRecordOptions = {
  quantity?: number;
  metadata?: Record<string, unknown>;
};

type SupabaseUsageError = {
  code?: string;
  message?: string;
};

const USAGE_LIMITS: Record<UsageAction, UsageLimit> = {
  ai_deep_search: { dailyLimit: 20 },
  ai_image_optimize: { dailyLimit: 20 },
  ai_label_analysis: { dailyLimit: 20 },
  ai_transcript_interpretation: { dailyLimit: 30 },
  ai_visual_explanation: { dailyLimit: 10 },
  ai_visual_images: { dailyLimit: 3 },
  image_upload: { dailyLimit: 30 },
  signup_email: { dailyLimit: 5 },
  stt: { dailyLimit: 30 },
  wine_submit: { dailyLimit: 100 },
};

export class UsageLimitError extends Error {
  status = 429;

  constructor(
    public readonly action: UsageAction,
    public readonly dailyLimit: number,
  ) {
    super("Daily usage limit exceeded");
    this.name = "UsageLimitError";
  }
}

export function isUsageLimitError(error: unknown): error is UsageLimitError {
  return error instanceof UsageLimitError;
}

function startOfUtcDay() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

function normalizeQuantity(quantity?: number) {
  if (!quantity || !Number.isFinite(quantity)) return 1;
  return Math.max(1, Math.ceil(quantity));
}

function isMissingUsageEventsTable(error: SupabaseUsageError | null | undefined) {
  if (!error) return false;
  const message = error.message || "";
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    (message.includes("usage_events") && (
      message.includes("schema cache") ||
      message.includes("Could not find the table") ||
      message.includes("does not exist")
    ))
  );
}

function warnUsageEventsUnavailable(action: UsageAction, phase: "lookup" | "insert", error: SupabaseUsageError) {
  console.warn("Usage limits skipped because usage_events is unavailable.", {
    action,
    phase,
    code: error.code,
    message: error.message,
  });
}

async function getCurrentUsageTotal(match: { userId?: string; subjectKey?: string }, action: UsageAction) {
  const supabase = getSupabaseClient();
  let query = supabase
    .from("usage_events")
    .select("quantity")
    .eq("action", action)
    .gte("created_at", startOfUtcDay())
    .limit(1000);

  if (match.userId) {
    query = query.eq("user_id", match.userId);
  } else if (match.subjectKey) {
    query = query.eq("subject_key", match.subjectKey);
  } else {
    throw new Error("Usage owner is required");
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingUsageEventsTable(error)) {
      warnUsageEventsUnavailable(action, "lookup", error);
      return null;
    }

    throw new Error(`Usage lookup failed: ${error.message}`);
  }

  return (data || []).reduce((total, row) => total + Number(row.quantity || 0), 0);
}

async function checkAndInsertUsage(
  match: { userId?: string; subjectKey?: string },
  action: UsageAction,
  options: UsageRecordOptions = {},
) {
  const quantity = normalizeQuantity(options.quantity);
  const limit = USAGE_LIMITS[action].dailyLimit;
  const used = await getCurrentUsageTotal(match, action);

  if (used === null) {
    return;
  }

  if (used + quantity > limit) {
    throw new UsageLimitError(action, limit);
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("usage_events")
    .insert({
      user_id: match.userId ?? null,
      subject_key: match.subjectKey ?? null,
      action,
      quantity,
      metadata: options.metadata ?? {},
    });

  if (error) {
    if (isMissingUsageEventsTable(error)) {
      warnUsageEventsUnavailable(action, "insert", error);
      return;
    }

    throw new Error(`Usage insert failed: ${error.message}`);
  }
}

export async function checkAndRecordUserUsage(
  userId: string,
  action: UsageAction,
  options: UsageRecordOptions = {},
) {
  await checkAndInsertUsage({ userId }, action, options);
}

export async function checkAndRecordSubjectUsage(
  subjectKey: string,
  action: UsageAction,
  options: UsageRecordOptions = {},
) {
  await checkAndInsertUsage({ subjectKey }, action, options);
}

export function createUsageSubjectKey(kind: string, value: string) {
  const normalized = value.trim().toLowerCase();
  const hash = createHash("sha256").update(normalized).digest("hex");
  return `${kind}:${hash}`;
}

export function usageLimitResponseMessage(error: UsageLimitError) {
  return `Daily limit exceeded for ${error.action}. Limit: ${error.dailyLimit}`;
}

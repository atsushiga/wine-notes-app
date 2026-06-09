import { getSupabaseClient } from "@/lib/supabase";

type WineImageReference = {
  tasting_note_id: number | string;
};

type TastingNoteOwner = {
  id: number | string;
};

type AiExplanationReference = {
  image_url?: string | null;
  input?: unknown;
  explanation?: unknown;
};

export function storageKeyToImageUrl(key: string) {
  return `/api/images/${key}`;
}

function isUserScopedImageKey(userId: string, key: string) {
  return key.startsWith(`uploads/${userId}/`) || key.startsWith(`ai-explanations/${userId}/`);
}

async function findWineImageNoteIds(apiPath: string, key: string) {
  const supabase = getSupabaseClient();
  const noteIds = new Set<number | string>();

  const queries = [
    supabase.from("wine_images").select("tasting_note_id").eq("url", apiPath).limit(20),
    supabase.from("wine_images").select("tasting_note_id").eq("thumbnail_url", apiPath).limit(20),
    supabase.from("wine_images").select("tasting_note_id").eq("storage_path", key).limit(20),
  ];

  const results = await Promise.all(queries);
  for (const { data, error } of results) {
    if (error) {
      console.error("Image ownership lookup failed:", error);
      continue;
    }

    for (const row of (data || []) as WineImageReference[]) {
      if (row.tasting_note_id != null) {
        noteIds.add(row.tasting_note_id);
      }
    }
  }

  return Array.from(noteIds);
}

async function hasOwnedWineImageReference(userId: string, apiPath: string, key: string) {
  const noteIds = await findWineImageNoteIds(apiPath, key);
  if (noteIds.length === 0) return false;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("tasting_notes")
    .select("id")
    .in("id", noteIds)
    .eq("user_id", userId)
    .limit(1);

  if (error) {
    console.error("Image note ownership lookup failed:", error);
    return false;
  }

  return ((data || []) as TastingNoteOwner[]).length > 0;
}

async function hasOwnedAiExplanationReference(userId: string, apiPath: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("ai_explanations")
    .select("image_url,input,explanation")
    .eq("user_id", userId)
    .limit(500);

  if (error) {
    console.error("AI explanation image ownership lookup failed:", error);
    return false;
  }

  return ((data || []) as AiExplanationReference[]).some((row) => (
    row.image_url === apiPath ||
    JSON.stringify(row.input ?? {}).includes(apiPath) ||
    JSON.stringify(row.explanation ?? {}).includes(apiPath)
  ));
}

export async function canUserAccessImageKey(userId: string, key: string) {
  if (!key || key.includes("..")) return false;
  if (isUserScopedImageKey(userId, key)) return true;

  const apiPath = storageKeyToImageUrl(key);

  if (await hasOwnedWineImageReference(userId, apiPath, key)) {
    return true;
  }

  if (key.startsWith("ai-explanations/")) {
    return hasOwnedAiExplanationReference(userId, apiPath);
  }

  return false;
}

export async function assertUserCanAccessImageKey(userId: string, key: string) {
  const canAccess = await canUserAccessImageKey(userId, key);
  if (!canAccess) {
    throw new Error("Image not found");
  }
}

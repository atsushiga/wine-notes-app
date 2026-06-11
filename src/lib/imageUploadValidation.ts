export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;

const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const ALLOWED_IMAGE_TYPES = new Set(Object.values(EXTENSION_CONTENT_TYPES));

export function extensionForImageUpload(filename: string, contentType: string): string {
  const rawExtension = filename.split(".").pop();
  if (rawExtension && rawExtension !== filename) {
    return rawExtension.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  }

  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/gif") return "gif";
  if (contentType === "image/heic") return "heic";
  if (contentType === "image/heif") return "heif";

  return "bin";
}

export function normalizeImageUploadContentType(filename: string, providedContentType?: string | null) {
  const contentType = providedContentType || "";
  if (ALLOWED_IMAGE_TYPES.has(contentType)) return contentType;

  const extension = filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return extension ? EXTENSION_CONTENT_TYPES[extension] || null : null;
}

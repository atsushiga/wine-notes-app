export function isProtectedImageUrl(src?: string | null) {
  if (!src) return false;
  return src.startsWith("/api/images/") || src.includes("/api/images/");
}

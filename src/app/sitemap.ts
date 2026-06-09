import type { MetadataRoute } from "next";

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://www.wine-note.jp";
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = new Date();

  return ["/terms", "/privacy", "/contact"].map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.4,
  }));
}

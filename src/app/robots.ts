import type { MetadataRoute } from "next";

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://www.wine-note.jp";
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/terms", "/privacy", "/contact", "/reset-password"],
        disallow: [
          "/",
          "/ai-explainer",
          "/api/",
          "/settings",
          "/statistics",
          "/tasting-notes",
          "/wines/",
        ],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}

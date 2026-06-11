import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

const PUBLIC_PATHS = new Set([
  "/login",
  "/signup",
  "/set-password",
  "/offline",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icon.png",
  "/apple-icon.png",
  "/terms",
  "/privacy",
  "/contact",
  "/reset-password",
]);

const PUBLIC_PREFIXES = [
  "/auth/",
  "/api/auth/",
  "/_next/",
  "/icons/",
];

const PROTECTED_PAGE_PREFIXES = [
  "/",
  "/ai-explainer",
  "/app",
  "/settings",
  "/statistics",
  "/tasting-notes",
  "/wines",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

function isProtectedPagePath(pathname: string): boolean {
  if (isPublicPath(pathname) || isApiPath(pathname)) return false;
  return PROTECTED_PAGE_PREFIXES.some((prefix) => (
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  ));
}

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (isProtectedPagePath(pathname) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

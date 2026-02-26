import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

const PROTECTED_PREFIX = "/app";
const PROTECTED_SET_PASSWORD = "/set-password";

function isProtectedPath(pathname: string): boolean {
    return pathname.startsWith(PROTECTED_PREFIX) || pathname === PROTECTED_SET_PASSWORD;
}

export async function middleware(request: NextRequest) {
    const { response, user } = await updateSession(request);
    const { pathname } = request.nextUrl;

    if (isProtectedPath(pathname) && !user) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        return NextResponse.redirect(url);
    }

    if (user && pathname.startsWith("/login")) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        return NextResponse.redirect(url);
    }

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - images, icons, etc (if any in public) - avoiding standard extension patterns
         * - api/images (public image access)
         */
        "/((?!_next/static|_next/image|favicon.ico|api/images|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};

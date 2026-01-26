import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const SIGN_IN_PATH = "/signin";

function redirectToSignIn(req: NextRequest) {
    const url = new URL(SIGN_IN_PATH, req.url);
    url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
}

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    if (pathname.startsWith("/dashboard")) {
        const token = await getToken({ req });
        if (!token) return redirectToSignIn(req);

        // Role-based access:
        // - /dashboard (overview) is visible to all authenticated roles (incl. VIEWER)
        // - /dashboard/forbidden must be accessible to avoid redirect loops
        // - everything else under /dashboard requires ADMIN or EDITOR
        const role = (token as { role?: string }).role;
        const isOverview = pathname === "/dashboard" || pathname === "/dashboard/";
        const isForbidden = pathname === "/dashboard/forbidden";

        if (!isOverview && !isForbidden) {
            if (role !== "ADMIN" && role !== "EDITOR") {
                const url = req.nextUrl.clone();
                url.pathname = "/dashboard/forbidden";
                return NextResponse.redirect(url);
            }
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/dashboard/:path*"],
};

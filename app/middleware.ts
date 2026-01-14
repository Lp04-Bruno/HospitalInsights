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

    // Protect everything under /dashboard
    if (pathname.startsWith("/dashboard")) {
        const token = await getToken({ req });
        if (!token) return redirectToSignIn(req);

        // Role-based access: only ADMIN/EDITOR get into dashboard
        const role = (token as { role?: string }).role;
        if (role !== "ADMIN" && role !== "EDITOR") {
            const url = req.nextUrl.clone();
            url.pathname = "/dashboard/forbidden";
            return NextResponse.redirect(url);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/dashboard/:path*"],
};

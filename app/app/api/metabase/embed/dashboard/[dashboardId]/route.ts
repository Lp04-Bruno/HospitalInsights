import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function GET(
    _req: NextRequest,
    { params }: { params: { dashboardId: string } }
) {
    const dashboardId = Number(params.dashboardId);
    if (!Number.isFinite(dashboardId)) {
        return NextResponse.json({ error: "Invalid dashboard id" }, { status: 400 });
    }

    const METABASE_SITE_URL = process.env.METABASE_SITE_URL;
    const METABASE_EMBED_SECRET = process.env.METABASE_EMBED_SECRET;

    if (!METABASE_SITE_URL || !METABASE_EMBED_SECRET) {
        return NextResponse.json(
            { error: "Missing METABASE_SITE_URL or METABASE_EMBED_SECRET" },
            { status: 500 }
        );
    }

    const payload = {
        resource: { dashboard: dashboardId },
        params: {},
        exp: Math.round(Date.now() / 1000) + 60 * 10,
    };

    const token = jwt.sign(payload, METABASE_EMBED_SECRET);
    const iframeUrl = `${METABASE_SITE_URL}/embed/dashboard/${token}#bordered=true&titled=true`;

    return NextResponse.json({ iframeUrl });
}

import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

function safeParamKey(input: string | undefined | null) {
    if (!input) return undefined;
    const trimmed = input.trim();
    if (!trimmed) return undefined;
    if (!/^[A-Za-z0-9_]{1,64}$/.test(trimmed)) return undefined;
    return trimmed;
}

export async function GET(
    _req: NextRequest,
    { params }: { params: { dashboardId: string } | Promise<{ dashboardId: string }> }
) {
    const resolvedParams = await Promise.resolve(params);
    const dashboardId = Number(resolvedParams.dashboardId);
    if (!Number.isFinite(dashboardId)) {
        return NextResponse.json({ error: "Invalid dashboard id" }, { status: 400 });
    }

    const url = new URL(_req.url);
    const hospitalId = url.searchParams.get("hospitalId") ?? undefined;
    const overrideParamKey = safeParamKey(url.searchParams.get("paramKey"));

    const METABASE_SITE_URL = process.env.METABASE_SITE_URL;
    const METABASE_EMBED_SECRET = process.env.METABASE_EMBED_SECRET;

    if (!METABASE_SITE_URL || !METABASE_EMBED_SECRET) {
        return NextResponse.json(
            { error: "Missing METABASE_SITE_URL or METABASE_EMBED_SECRET" },
            { status: 500 }
        );
    }

    const hospitalParamKey = overrideParamKey ?? process.env.METABASE_EMBED_HOSPITAL_PARAM ?? "hospitalId";
    const embedParams: Record<string, string> = {};
    if (hospitalId) {
        embedParams[hospitalParamKey] = hospitalId;
    }

    const payload = {
        resource: { dashboard: dashboardId },
        params: embedParams,
        exp: Math.round(Date.now() / 1000) + 60 * 10,
    };

    const token = jwt.sign(payload, METABASE_EMBED_SECRET);
    const iframeUrl = `${METABASE_SITE_URL}/embed/dashboard/${token}#bordered=true&titled=true`;

    return NextResponse.json({ iframeUrl });
}

import { NextRequest, NextResponse } from "next/server";

import { buildMetabaseEmbedUrl, findAllowedMetabaseView, MissingMetabaseConfigError } from "@/lib/metabase";

export async function GET(_req: NextRequest, { params }: { params: { dashboardId: string } | Promise<{ dashboardId: string }> }) {
  const resolvedParams = await Promise.resolve(params);
  const dashboardId = Number(resolvedParams.dashboardId);
  if (!Number.isFinite(dashboardId)) {
    return NextResponse.json({ error: "Invalid dashboard id" }, { status: 400 });
  }

  const allowed = findAllowedMetabaseView("dashboard", dashboardId);
  if (!allowed) {
    return NextResponse.json({ error: "Dashboard not allowed" }, { status: 404 });
  }

  const url = new URL(_req.url);
  const hospitalId = url.searchParams.get("hospitalId") ?? undefined;

  try {
    const iframeUrl = await buildMetabaseEmbedUrl(allowed, hospitalId);
    return NextResponse.json({ iframeUrl });
  } catch (err) {
    if (err instanceof MissingMetabaseConfigError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    throw err;
  }
}

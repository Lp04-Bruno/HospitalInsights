import { NextRequest, NextResponse } from "next/server";

import { buildMetabaseEmbedUrl, findAllowedMetabaseView, MissingMetabaseConfigError } from "@/lib/metabase";

export async function GET(req: NextRequest, { params }: { params: { questionId: string } | Promise<{ questionId: string }> }) {
  const resolvedParams = await Promise.resolve(params);
  const questionId = Number(resolvedParams.questionId);
  if (!Number.isFinite(questionId)) {
    return NextResponse.json({ error: "Invalid question id" }, { status: 400 });
  }

  const allowed = findAllowedMetabaseView("question", questionId);
  if (!allowed) {
    return NextResponse.json({ error: "Question not allowed" }, { status: 404 });
  }

  const url = new URL(req.url);
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

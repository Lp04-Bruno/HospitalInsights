import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

type ViewConfig = {
  type: "dashboard" | "question";
  id: number;
  hospitalParamKey?: string;
};

function parseViewCatalog(): ViewConfig[] {
  const raw = process.env.METABASE_DASHBOARD_CATALOG;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Array<Partial<ViewConfig>>;
    return parsed
      .map(
        (v): ViewConfig => ({
          type: v.type === "question" ? "question" : "dashboard",
          id: Number(v.id),
          hospitalParamKey:
            typeof v.hospitalParamKey === "string" && v.hospitalParamKey.trim()
              ? v.hospitalParamKey.trim()
              : undefined,
        })
      )
      .filter((v) => Number.isFinite(v.id));
  } catch {
    return [];
  }
}

function getAllowedQuestionConfig(questionId: number): ViewConfig | null {
  const fromCatalog = parseViewCatalog().find((v) => v.type === "question" && v.id === questionId);
  if (fromCatalog) return fromCatalog;
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { questionId: string } | Promise<{ questionId: string }> }
) {
  const resolvedParams = await Promise.resolve(params);
  const questionId = Number(resolvedParams.questionId);
  if (!Number.isFinite(questionId)) {
    return NextResponse.json({ error: "Invalid question id" }, { status: 400 });
  }

  const allowed = getAllowedQuestionConfig(questionId);
  if (!allowed) {
    return NextResponse.json({ error: "Question not allowed" }, { status: 404 });
  }

  const url = new URL(req.url);
  const hospitalId = url.searchParams.get("hospitalId") ?? undefined;

  const METABASE_SITE_URL = process.env.METABASE_SITE_URL;
  const METABASE_EMBED_SECRET = process.env.METABASE_EMBED_SECRET;

  if (!METABASE_SITE_URL || !METABASE_EMBED_SECRET) {
    return NextResponse.json(
      { error: "Missing METABASE_SITE_URL or METABASE_EMBED_SECRET" },
      { status: 500 }
    );
  }

  const hospitalParamKey =
    allowed.hospitalParamKey ??
    process.env.METABASE_EMBED_HOSPITAL_PARAM ??
    "hospitalId";
  const embedParams: Record<string, string> = {};
  if (hospitalId) {
    embedParams[hospitalParamKey] = hospitalId;
  }

  const payload = {
    resource: { question: questionId },
    params: embedParams,
    exp: Math.round(Date.now() / 1000) + 60 * 10,
  };

  const token = jwt.sign(payload, METABASE_EMBED_SECRET);
  const iframeUrl = `${METABASE_SITE_URL}/embed/question/${token}#bordered=true&titled=true`;

  return NextResponse.json({ iframeUrl });
}

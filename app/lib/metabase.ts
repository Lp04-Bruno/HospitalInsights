import { SignJWT } from "jose";

export type MetabaseViewType = "dashboard" | "question";

export type MetabaseCatalogView = {
  type: MetabaseViewType;
  id: number;
  name?: string;
  hospitalParamKey?: string;
};

export type MetabaseLandingView = MetabaseCatalogView & {
  name: string;
};

export class MissingMetabaseConfigError extends Error {
  constructor() {
    super("Missing METABASE_SITE_URL or METABASE_EMBED_SECRET");
  }
}

function normalizeViewType(raw: unknown): MetabaseViewType {
  return raw === "question" ? "question" : "dashboard";
}

export function parseMetabaseCatalog(raw = process.env.METABASE_DASHBOARD_CATALOG): MetabaseCatalogView[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as Array<
      Partial<{
        type: MetabaseViewType;
        id: number;
        name: string;
        hospitalParamKey: string;
      }>
    >;

    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((view): MetabaseCatalogView => {
        const name = typeof view.name === "string" ? view.name.trim() : "";
        const hospitalParamKey = typeof view.hospitalParamKey === "string" ? view.hospitalParamKey.trim() : "";

        return {
          type: normalizeViewType(view.type),
          id: Number(view.id),
          ...(name ? { name } : null),
          ...(hospitalParamKey ? { hospitalParamKey } : null),
        };
      })
      .filter((view) => Number.isFinite(view.id));
  } catch {
    return [];
  }
}

export function getInitialMetabaseView(): Pick<MetabaseCatalogView, "type" | "id"> | undefined {
  const raw = process.env.METABASE_DASHBOARD_ID;
  if (!raw) return undefined;

  const id = Number(raw);
  return Number.isFinite(id) ? { type: "dashboard", id } : undefined;
}

export function getMetabaseLandingViews(): MetabaseLandingView[] {
  const views = parseMetabaseCatalog()
    .filter((view): view is MetabaseLandingView => typeof view.name === "string" && view.name.length > 0)
    .map((view) => ({ ...view }));

  if (views.length > 0) return views;

  const initialView = getInitialMetabaseView();
  return initialView ? [{ ...initialView, name: "Dashboard" }] : [];
}

export function findAllowedMetabaseView(type: MetabaseViewType, id: number): MetabaseCatalogView | null {
  const fromCatalog = parseMetabaseCatalog().find((view) => view.type === type && view.id === id);
  if (fromCatalog) return fromCatalog;

  const fallback = getInitialMetabaseView();
  if (type === "dashboard" && fallback?.id === id) {
    return { type, id };
  }

  return null;
}

export async function buildMetabaseEmbedUrl(view: MetabaseCatalogView, hospitalId?: string): Promise<string> {
  const siteUrl = process.env.METABASE_SITE_URL?.replace(/\/+$/, "");
  const embedSecret = process.env.METABASE_EMBED_SECRET;

  if (!siteUrl || !embedSecret) {
    throw new MissingMetabaseConfigError();
  }

  const hospitalParamKey = view.hospitalParamKey ?? process.env.METABASE_EMBED_HOSPITAL_PARAM ?? "hospitalId";
  const params: Record<string, string> = {};
  if (hospitalId) {
    params[hospitalParamKey] = hospitalId;
  }

  const resource = view.type === "question" ? { question: view.id } : { dashboard: view.id };
  const token = await new SignJWT({ resource, params })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(embedSecret));

  return `${siteUrl}/embed/${view.type}/${token}#bordered=true&titled=true`;
}

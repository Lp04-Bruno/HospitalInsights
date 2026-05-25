import { SignJWT } from "jose";
import { z } from "zod";

import { searchNumberSchema } from "@/lib/validation";

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

const catalogViewSchema = z
  .object({
    type: z.preprocess(normalizeViewType, z.enum(["dashboard", "question"])),
    id: searchNumberSchema,
    name: z.string().trim().min(1).optional(),
    hospitalParamKey: z.string().trim().min(1).optional(),
  })
  .strip();

const catalogSchema = z.array(catalogViewSchema);

const metabaseEmbedEnvSchema = z.object({
  METABASE_SITE_URL: z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.replace(/\/+$/, "")),
  METABASE_EMBED_SECRET: z.string().trim().min(1),
});

export function parseMetabaseCatalog(raw = process.env.METABASE_DASHBOARD_CATALOG): MetabaseCatalogView[] {
  if (!raw) return [];

  try {
    const parsed = catalogSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function getInitialMetabaseView(): Pick<MetabaseCatalogView, "type" | "id"> | undefined {
  const raw = process.env.METABASE_DASHBOARD_ID;
  if (!raw) return undefined;

  const id = searchNumberSchema.safeParse(raw);
  return id.success ? { type: "dashboard", id: id.data } : undefined;
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
  const env = metabaseEmbedEnvSchema.safeParse(process.env);

  if (!env.success) {
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
    .sign(new TextEncoder().encode(env.data.METABASE_EMBED_SECRET));

  return `${env.data.METABASE_SITE_URL}/embed/${view.type}/${token}#bordered=true&titled=true`;
}

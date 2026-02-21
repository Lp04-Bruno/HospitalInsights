function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function hasEnv(name) {
  return Boolean(process.env[name] && String(process.env[name]).trim());
}

function main() {
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) {
    console.log("[env] NODE_ENV!=production -> skipping strict env validation");
    return;
  }

  requireEnv("DATABASE_URL");
  requireEnv("NEXTAUTH_URL");
  requireEnv("NEXTAUTH_SECRET");
  requireEnv("METABASE_SITE_URL");

  const hasSiteUrl = hasEnv("METABASE_SITE_URL");
  const hasEmbedSecret = hasEnv("METABASE_EMBED_SECRET");
  const hasDashboardId = hasEnv("METABASE_DASHBOARD_ID");
  const hasCatalog = hasEnv("METABASE_DASHBOARD_CATALOG");

  if (!hasSiteUrl || !hasEmbedSecret) {
    console.warn(
      "[env] Metabase embedding not fully configured (METABASE_SITE_URL / METABASE_EMBED_SECRET missing). The landing page will show an error until configured."
    );
  }
  if (!hasDashboardId && !hasCatalog) {
    console.warn(
      "[env] No METABASE_DASHBOARD_ID or METABASE_DASHBOARD_CATALOG set. Configure at least one for the landing page."
    );
  }
  console.log("[env] Runtime env validation OK");
}

try {
  main();
} catch (err) {
  console.error("[env] Runtime env validation FAILED:", err?.message ?? err);
  process.exit(1);
}

import styles from "./page.module.css";
import Link from "next/link";
import { getServerAuthSession } from "@/lib/auth";
import jwt from "jsonwebtoken";

export default async function Home() {
  const session = await getServerAuthSession();
  const dashboardId = Number(process.env.METABASE_DASHBOARD_ID ?? "1");

  const METABASE_SITE_URL = process.env.METABASE_SITE_URL;
  const METABASE_EMBED_SECRET = process.env.METABASE_EMBED_SECRET;

  let iframeUrl: string | null = null;
  let iframeError: string | null = null;

  if (!Number.isFinite(dashboardId)) {
    iframeError = "Invalid dashboard id.";
  } else if (!METABASE_SITE_URL || !METABASE_EMBED_SECRET) {
    iframeError = "Missing METABASE_SITE_URL or METABASE_EMBED_SECRET.";
  } else {
    const payload = {
      resource: { dashboard: dashboardId },
      params: {},
      // eslint-disable-next-line react-hooks/purity
      exp: Math.round(Date.now() / 1000) + 60 * 10,
    };

    const token = jwt.sign(payload, METABASE_EMBED_SECRET);
    iframeUrl = `${METABASE_SITE_URL}/embed/dashboard/${token}#bordered=true&titled=true`;
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>HospitalInsights</h1>
        <nav className={styles.nav}>
          {session ? (
            <Link href="/dashboard" className={`${styles.button} ${styles.primary}`}>
              Dashboard
            </Link>
          ) : (
            <Link
              href="/signin?callbackUrl=/dashboard"
              className={`${styles.button} ${styles.primary}`}
            >
              Sign in
            </Link>
          )}
        </nav>
      </header>

      <div className={styles.frameWrap}>
        {iframeUrl ? (
          <iframe title="Metabase Dashboard" src={iframeUrl} className={styles.frame} />
        ) : (
          <div className={styles.notice}>{iframeError ?? "No dashboard iframeUrl returned."}</div>
        )}
      </div>
    </main>
  );
}



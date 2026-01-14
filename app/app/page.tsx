import styles from "./page.module.css";

export default async function Home() {
  const dashboardId = Number(process.env.METABASE_DASHBOARD_ID ?? "1");
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const res = await fetch(
    new URL(`/api/metabase/embed/dashboard/${dashboardId}`, baseUrl),
    { cache: "no-store" }
  );
  const data = await res.json();

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>HospitalInsights</h1>

      <div className={styles.frameWrap}>
        {data.iframeUrl ? (
          <iframe title="Metabase Dashboard" src={data.iframeUrl} className={styles.frame} />
        ) : (
          <div className={styles.notice}>No dashboard iframeUrl returned.</div>
        )}
      </div>
    </main>
  );
}



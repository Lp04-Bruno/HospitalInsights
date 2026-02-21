import styles from "./page.module.css";
import Link from "next/link";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LandingExplorer from "@/app/_components/LandingExplorer";

type ViewOption = {
  type: "dashboard" | "question";
  id: number;
  name: string;
  hospitalParamKey?: string;
};

export default async function Home() {
  const session = await getServerAuthSession();

  const initialDashboardId = Number(process.env.METABASE_DASHBOARD_ID ?? "1");
  const initialView = Number.isFinite(initialDashboardId)
    ? ({ type: "dashboard", id: initialDashboardId } as const)
    : undefined;
  const dashboardsFromEnvRaw = process.env.METABASE_DASHBOARD_CATALOG;

  const views: ViewOption[] = (() => {
    if (dashboardsFromEnvRaw) {
      try {
        const parsed = JSON.parse(dashboardsFromEnvRaw) as Array<
          Partial<{
            type: "dashboard" | "question";
            id: number;
            name: string;
            hospitalParamKey: string;
          }>
        >;

        const normalized: ViewOption[] = parsed
          .filter((d) => Number.isFinite(Number(d.id)) && typeof d.name === "string" && d.name)
          .map((d) => ({
            type: (d.type === "question" ? "question" : "dashboard") as ViewOption["type"],
            id: Number(d.id),
            name: String(d.name),
            ...(typeof d.hospitalParamKey === "string" && d.hospitalParamKey
              ? { hospitalParamKey: d.hospitalParamKey }
              : null),
          }));

        if (normalized.length > 0) return normalized;
      } catch {
        // Ignore invalid env JSON
      }
    }

    if (Number.isFinite(initialDashboardId)) {
      return [{ type: "dashboard" as const, id: initialDashboardId, name: "Dashboard" }];
    }

    return [];
  })();

  const hospitals = await prisma.hospital.findMany({
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true, city: true, state: true },
  });

  return (
    <main className={styles.shell}>
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <h1 className={styles.title}>HospitalInsights</h1>
            <p className={styles.subtitle}>Auswertung und Vergleich von Kennzahlen.</p>
          </div>
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

        <section className={styles.hero} aria-label="Start">
          <div className={styles.heroContent}>
            <div className={styles.heroBadge}>Metabase</div>
            <h2 className={styles.heroTitle}>Kennzahlen pro Krankenhaus</h2>
            <p className={styles.heroText}>
              Wähle Ansicht und Krankenhaus aus. Optional kannst du zwei Krankenhäuser nebeneinander
              vergleichen.
            </p>

            <div className={styles.stats}>
              <div className={styles.stat}>
                <div className={styles.statValue}>{views.length}</div>
                <div className={styles.statLabel}>Ansichten</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statValue}>{hospitals.length}</div>
                <div className={styles.statLabel}>Krankenhäuser</div>
              </div>
            </div>
          </div>
          <div className={styles.heroArt} aria-hidden="true" />
        </section>

        {views.length > 0 ? (
          <LandingExplorer views={views} hospitals={hospitals} initialView={initialView} />
        ) : (
          <section className={styles.notice} aria-label="Hinweis">
            Keine Metabase-Ansicht konfiguriert. Setze `METABASE_DASHBOARD_ID` oder
            `METABASE_DASHBOARD_CATALOG`.
          </section>
        )}
      </div>
    </main>
  );
}



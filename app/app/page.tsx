import styles from "./page.module.css";
import Link from "next/link";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LandingExplorer from "@/app/_components/LandingExplorer";
import Footer from "@/app/_components/Footer";

type ViewOption = {
  type: "dashboard" | "question";
  id: number;
  name: string;
  hospitalParamKey?: string;
};

export default async function Home() {
  const session = await getServerAuthSession();

  const initialDashboardId = process.env.METABASE_DASHBOARD_ID ? Number(process.env.METABASE_DASHBOARD_ID) : Number.NaN;
  const initialView = Number.isFinite(initialDashboardId) ? ({ type: "dashboard", id: initialDashboardId } as const) : undefined;
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
            ...(typeof d.hospitalParamKey === "string" && d.hospitalParamKey ? { hospitalParamKey: d.hospitalParamKey } : null),
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

  const featuredHospitals = hospitals.slice(0, 2);
  const canCompare = hospitals.length >= 2;
  const explorerHref = views.length > 0 ? "#insights-explorer" : "#landing-notice";
  const previewViewName = views[0]?.name ?? "Top Metrics";
  const previewMetrics = [
    { label: "Liquidität", valueA: 86, valueB: 74 },
    { label: "Eigenkapital", valueA: 68, valueB: 72 },
    { label: "Rohergebnis", valueA: 78, valueB: 64 },
    { label: "Materialquote", valueA: 58, valueB: 61 },
    { label: "Verbindlichkeiten", valueA: 82, valueB: 76 },
  ];

  return (
    <main className={styles.shell}>
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <h1 className={styles.title}>Hospitalinsights</h1>
            <p className={styles.subtitle}>Auswertung und Vergleich von Kennzahlen.</p>
          </div>
          <nav className={styles.nav}>
            {session ? (
              <Link href="/dashboard" className={`${styles.button} ${styles.primary}`}>
                Dashboard
              </Link>
            ) : (
              <Link href="/signin?callbackUrl=/dashboard" className={`${styles.button} ${styles.primary}`}>
                Sign in
              </Link>
            )}
          </nav>
        </header>

        <section className={styles.hero} aria-label="Start">
          <div className={styles.heroBackdrop} aria-hidden="true" />
          <div className={styles.heroContent}>
            <div className={styles.heroBadge}>Metabase Explorer</div>
            <h2 className={styles.heroTitle}>Kennzahlen schnell vergleichen.</h2>
            <p className={styles.heroText}>Ansicht wählen, Krankenhaus auswählen, direkt starten.</p>

            <div className={styles.heroActions}>
              <a href={explorerHref} className={`${styles.button} ${styles.primary}`}>
                Direkt zum Tool
              </a>
            </div>

            <a href={explorerHref} className={styles.scrollCue}>
              <span className={styles.scrollCueDot} />
              <span>Zum Explorer scrollen</span>
            </a>

            <div className={styles.stats}>
              <div className={styles.stat}>
                <div className={styles.statValue}>{views.length}</div>
                <div className={styles.statLabel}>Ansichten</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statValue}>{hospitals.length}</div>
                <div className={styles.statLabel}>Krankenhäuser</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statValue}>{canCompare ? "Ja" : "Bald"}</div>
                <div className={styles.statLabel}>Vergleich</div>
              </div>
            </div>
          </div>

          <div className={styles.heroStage} aria-hidden="true">
            <div className={styles.stageFrame}>
              <div className={styles.stageTopbar}>
                <div className={styles.stageTopbarTitle}>Preview</div>
                <div className={styles.stageTopbarMeta}>{previewViewName}</div>
              </div>

              <div className={styles.stagePanel}>
                <div className={styles.stageSummary}>
                  <div className={styles.stageSummaryHeader}>
                    <div>
                      <div className={styles.stageCardLabel}>Ansicht</div>
                      <div className={styles.stageSummaryTitle}>{previewViewName}</div>
                    </div>
                    <div className={styles.stageLegend}>
                      <span className={`${styles.stageLegendItem} ${styles.stageLegendPrimary}`}>
                        {featuredHospitals[0]?.name ?? "Krankenhaus A"}
                      </span>
                      <span className={`${styles.stageLegendItem} ${styles.stageLegendSecondary}`}>
                        {featuredHospitals[1]?.name ?? "Krankenhaus B"}
                      </span>
                    </div>
                  </div>

                  <div className={styles.stageChart}>
                    <div className={styles.stageChartGrid} />
                    <div className={styles.stageLines}>
                      <div className={`${styles.stageLine} ${styles.stageLinePrimary}`} />
                      <div className={`${styles.stageLine} ${styles.stageLineSecondary}`} />
                    </div>
                    <div className={styles.stageBars}>
                      {previewMetrics.map((metric) => (
                        <div key={metric.label} className={styles.stageMetricRow}>
                          <div className={styles.stageMetricLabel}>{metric.label}</div>
                          <div className={styles.stageMetricBars}>
                            <span
                              className={`${styles.stageMetricBar} ${styles.stageMetricBarPrimary}`}
                              style={{ width: `${metric.valueA}%` }}
                            />
                            <span
                              className={`${styles.stageMetricBar} ${styles.stageMetricBarSecondary}`}
                              style={{ width: `${metric.valueB}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={styles.stageTicker}>
                    <div className={styles.stageTickerTrack}>
                      <span>{featuredHospitals[0]?.name ?? "Krankenhaus A"}</span>
                      <span>{featuredHospitals[1]?.name ?? "Krankenhaus B"}</span>
                      <span>Liquidität</span>
                      <span>Eigenkapital</span>
                      <span>Rohergebnis</span>
                      <span>{previewViewName}</span>
                    </div>
                  </div>
                </div>

                <div className={styles.stageCards}>
                  <div className={styles.stageCardSmall}>
                    <div className={styles.stageCardLabel}>Krankenhäuser</div>
                    <div className={styles.stageCardMetric}>{String(hospitals.length).padStart(2, "0")}</div>
                    <div className={styles.stageMiniNote}>Im Explorer verfügbar</div>
                  </div>
                  <div className={styles.stageCardSmall}>
                    <div className={styles.stageCardLabel}>Vergleich</div>
                    <div className={styles.stageCardMetric}>{canCompare ? "Live" : "Off"}</div>
                    <div className={styles.stageMiniNote}>{canCompare ? "Zwei Häuser parallel" : "Mindestens zwei Häuser nötig"}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.explorerSection} aria-label="Explorer">
          {views.length > 0 ? (
            <div id="insights-explorer" className={styles.explorerAnchor}>
              <LandingExplorer views={views} hospitals={hospitals} initialView={initialView} />
            </div>
          ) : (
            <section id="landing-notice" className={styles.notice} aria-label="Hinweis">
              Keine Metabase-Ansicht konfiguriert. Setze `METABASE_DASHBOARD_ID` oder `METABASE_DASHBOARD_CATALOG`.
            </section>
          )}
        </section>

        <Footer />
      </div>
    </main>
  );
}

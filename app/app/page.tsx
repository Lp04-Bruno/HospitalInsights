import styles from "./page.module.css";
import Image from "next/image";
import Link from "next/link";
import logoIcon from "@/assets/hospitalinsights_logo_icon_transparent.png";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LandingExplorer from "@/app/_components/LandingExplorer";
import Footer from "@/app/_components/Footer";
import LandingThemeToggle from "@/app/_components/LandingThemeToggle";

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

  const explorerHref = views.length > 0 ? "#insights-explorer" : "#landing-notice";
  const outputHref = views.length > 0 ? "#insights-output" : "#landing-notice";

  return (
    <main className={styles.shell}>
      <div className={styles.page}>
        <header className={styles.header}>
          <Link href="/" className={styles.brand} aria-label="Hospitalinsights Startseite">
            <Image className={styles.brandIcon} src={logoIcon} alt="" width={36} height={36} priority />
            <h1 className={styles.title}>Hospitalinsights</h1>
          </Link>
          <nav className={styles.nav}>
            <a href={explorerHref} className={styles.navLink}>
              Auswahl
            </a>
            <a href={outputHref} className={styles.navLink}>
              Ausgabe
            </a>
            {session ? (
              <Link href="/dashboard" className={styles.navLink}>
                Dashboard
              </Link>
            ) : (
              <Link href="/signin?callbackUrl=/dashboard" className={styles.navLink}>
                Dashboard
              </Link>
            )}
          </nav>
          <LandingThemeToggle />
        </header>

        <section className={styles.hero} aria-label="Start">
          <div className={styles.heroContent}>
            <h2 className={styles.heroTitle}>Datenbasierte Krankenhaus-Analyse</h2>
            <p className={styles.heroText}>
              Analysieren Sie finanzielle und operative Kennzahlen verschiedener Institutionen. Gewinnen Sie fundierte Einblicke durch
              unseren interaktiven Explorer.
            </p>
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

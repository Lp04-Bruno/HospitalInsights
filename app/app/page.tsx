import styles from "./page.module.css";
import Image from "next/image";
import Link from "next/link";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getInitialMetabaseView, getMetabaseLandingViews, type MetabaseLandingView } from "@/lib/metabase";
import LandingExplorer from "@/app/_components/LandingExplorer";
import Footer from "@/app/_components/Footer";
import LandingThemeToggle from "@/app/_components/LandingThemeToggle";

const logoIcon = "/assets/hospitalinsights-logo-icon.png";

export default async function Home() {
  const session = await getServerAuthSession();
  const initialView = getInitialMetabaseView();
  const views: MetabaseLandingView[] = getMetabaseLandingViews();

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

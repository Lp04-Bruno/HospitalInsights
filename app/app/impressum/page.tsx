import Link from "next/link";
import styles from "../legal.module.css";

export default function ImpressumPage() {
  return (
    <main className={styles.shell}>
      <div className={styles.page}>
        <Link className={styles.back} href="/">
          ← Zurück
        </Link>

        <section className={styles.card}>
          <header className={styles.header}>
            <h1 className={styles.title}>Impressum</h1>
          </header>
          <div className={styles.body}>
            <h2>Anbieter (Betreiber der Website)</h2>
            <p>
              <strong>HospitalInsights (Studienprojekt)</strong>
              <br />
              Rombergstraße 40
              <br />
              49377 Vechta
              <br />
              Deutschland
            </p>

            <h2>Kontakt</h2>
            <p>
              Ansprechpartner: Prof. Dr. Andreas Eiselt
              <br />
              Raum VEC E4
              <br />
              Rombergstraße 40, 49377 Vechta
              <br />
              Telefon: 04441 / 915 305
              <br />
              E-Mail: eiselt (at) phwt.de
            </p>

            <h2>Projektkontext</h2>
            <p>HospitalInsights ist ein Studienprojekt an der Privaten Hochschule für Wirtschaft und Technik (PHWT), Standort Vechta.</p>

            <h2>Haftungshinweis</h2>
            <p>
              Inhalte dieser Website wurden mit Sorgfalt erstellt. Für Richtigkeit, Vollständigkeit und Aktualität übernehmen wir keine
              Gewähr.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

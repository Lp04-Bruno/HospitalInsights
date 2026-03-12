import Link from "next/link";
import styles from "../legal.module.css";

export default function DatenschutzPage() {
  return (
    <main className={styles.shell}>
      <div className={styles.page}>
        <Link className={styles.back} href="/">
          ← Zurück
        </Link>

        <section className={styles.card}>
          <header className={styles.header}>
            <h1 className={styles.title}>Datenschutzerklärung</h1>
          </header>
          <div className={styles.body}>
            <h2>1. Verantwortlicher</h2>
            <p>
              Verantwortlich für die Verarbeitung personenbezogener Daten auf dieser Website ist:
              <br />
              <strong>Hospitalinsights (Studienprojekt)</strong>
              <br />
              Rombergstraße 40, 49377 Vechta, Deutschland
              <br />
              Ansprechpartner: Prof. Dr. Andreas Eiselt
              <br />
              Telefon: 04441 / 915 305
              <br />
              E-Mail: eiselt (at) phwt.de
            </p>

            <h2>2. Projektkontext</h2>
            <p>Hospitalinsights ist ein Studienprojekt an der Privaten Hochschule für Wirtschaft und Technik (PHWT), Standort Vechta.</p>

            <h2>3. Wissenschaftliche Betreuung (Kontakt an der PHWT)</h2>
            <p>
              Prof. Dr. Andreas Eiselt (Studienbereichsleiter Betriebswirtschaft)
              <br />
              Raum VEC E4, Rombergstraße 40, 49377 Vechta
              <br />
              Telefon: 04441 / 915 305
              <br />
              E-Mail: eiselt (at) phwt.de
            </p>

            <h2>4. Verarbeitungen beim Aufruf</h2>
            <p>
              Beim Aufruf der Website werden technisch notwendige Daten verarbeitet (z.B. IP-Adresse, Zeitstempel, User-Agent), um die Seite
              auszuliefern und abzusichern.
            </p>

            <h2>5. Externe Inhalte: Metabase</h2>
            <p>
              Auf der Landing Page können Metabase-Dashboards/Fragen als externe Inhalte eingebunden werden. Diese Inhalte werden erst nach
              Ihrer Zustimmung geladen.
            </p>

            <h2>6. Cookies / Einwilligung</h2>
            <p>
              Für das Laden externer Metabase-Inhalte wird eine Einwilligung gespeichert (Cookie) damit die Entscheidung beim nächsten
              Besuch nicht erneut abgefragt werden muss.
            </p>

            <p>
              Technische Umsetzung: Wir speichern Ihre Entscheidung als Cookie/LocalStorage-Eintrag mit dem Wert &quot;accepted&quot; oder
              &quot;declined&quot; (Standard-Laufzeit: 1 Jahr). Ohne Zustimmung werden die Metabase-Frames nicht geladen.
            </p>

            <h2>7. Ihre Rechte</h2>
            <ul>
              <li>Auskunft, Berichtigung, Löschung</li>
              <li>Einschränkung der Verarbeitung</li>
              <li>Datenübertragbarkeit</li>
              <li>Widerspruch / Widerruf der Einwilligung</li>
              <li>Beschwerde bei einer Aufsichtsbehörde</li>
            </ul>

            <h2>8. Kontakt</h2>
            <p>
              Für Datenschutzanfragen kontaktiert bitte:
              <br />
              Prof. Dr. Andreas Eiselt
              <br />
              Rombergstraße 40, 49377 Vechta
              <br />
              Telefon: 04441 / 915 305
              <br />
              E-Mail: eiselt (at) phwt.de
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

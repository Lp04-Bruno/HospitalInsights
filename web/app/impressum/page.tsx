import { PublicPageShell } from "@/app/_components/PublicPageShell";

export default function ImpressumPage() {
  return (
    <PublicPageShell title="Impressum">
      <h2>Anbieter (Betreiber der Website)</h2>
      <p>
        <strong>Hospitalinsights (Studienprojekt)</strong>
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
      <p>Hospitalinsights ist ein Studienprojekt an der Privaten Hochschule für Wirtschaft und Technik (PHWT), Standort Vechta.</p>

      <h2>Haftungshinweis</h2>
      <p>
        Inhalte dieser Website wurden mit Sorgfalt erstellt. Für Richtigkeit, Vollständigkeit und Aktualität übernehmen wir keine Gewähr.
      </p>
    </PublicPageShell>
  );
}

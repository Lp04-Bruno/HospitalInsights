# Changelog

Das Projekt orientiert sich an [Semantic Versioning](https://semver.org/lang/de/).

## [1.2.0] - Unreleased

### Added

- Source-available Lizenz für die öffentliche Repository-Veröffentlichung ergänzt.
- `CONTRIBUTING.md` mit Entwicklungsfluss, lokalen Checks und PR-Konventionen ergänzt.
- `SECURITY.md` mit Meldeweg, Scope und Disclosure-Hinweisen ergänzt.
- `CODE_OF_CONDUCT.md` für respektvolle Zusammenarbeit ergänzt.
- README-Lizenzhinweis und npm-Paketmetadaten für das öffentliche Repository ergänzt.
- `CODEOWNERS` ergänzt, damit Pull Requests automatisch den primären Maintainer anfragen.
- GitHub Issue Templates für Bug Reports und Feature Requests ergänzt.
- Pull Request Template mit Changelog-, Security-, Lizenz- und Test-Checkliste ergänzt.
- README-Hinweis zur eingeschränkten Nutzung von Name, Logo, Wortmarke und Branding-Assets ergänzt.

### Changed

- Demo-Datenfluss von gebündelten CSV-Sample-Daten auf bereitstellbare PostgreSQL-Dumps umgestellt.
- README-Quickstart präzisiert: `prisma db seed` legt lokale Admin-Credentials und den LineItem-Katalog an, aber keine realistischen Beispiel-Faktendaten mehr.
- Production-Env-Beispiel für öffentliche Nutzung bereinigt und an den aktuellen Backup-/Metabase-Betrieb angepasst.
- Prisma Client Generierung als Build-/Install-Schritt bestätigt, damit generierte Dateien nicht mehr versioniert oder in Docker-Kontexte kopiert werden müssen.
- Next.js-Projektordner von `app/` nach `web/` umbenannt, damit die Struktur für Außenstehende klarer ist (`web/app`, `web/lib`, `web/prisma`).
- App-Version und README-Badge auf `1.2.0` aktualisiert.
- Styling-Stack auf CSS Modules vereinfacht und README-Tech-Stack entsprechend angepasst.
- Dashboard-Routen, Navigationslabels und Rollenanforderungen in `web/lib/dashboardRoutes.ts` zentralisiert und erste Zugriffspfade daraus abgeleitet.
- Redirect-/Statusmeldungen für Dashboard-Aktionen über einen gemeinsamen Flash-Message-Helper gekapselt.
- Tests für Dashboard-Routen, Flash-Message-Parsing, Login-Rate-Limit-Keys und Security-Header ergänzt.
- Security Headers inklusive vorsichtiger CSP mit Metabase-Frame-Ausnahme in `web/next.config.ts` ergänzt.
- Redis-basiertes Rate Limiting für Credentials-Logins ergänzt und Compose um einen Redis-8.8-Alpine-Service erweitert.
- Dev-Compose-Start robuster gemacht: gemountete `node_modules` werden beim App-Start synchronisiert, damit neue Dependencies wie Redis-Client-Pakete nach Branch-Wechseln verfügbar sind.
- Serverseitige Passwortregeln für neue Benutzer und generierte temporäre Passwörter ergänzt.
- Restore-Aktionen zusätzlich durch Eingabe des vollständigen Backup-Dateinamens abgesichert.
- `SECURITY-AUDIT.md` ergänzt und aktuelle moderate npm-Audit-Findings bewusst triagiert.
- Legal Pages auf eine gemeinsame Public Page Shell umgestellt.
- Dashboard-Sidebar auf Mobile als kompaktere App-Shell mit einklappbarer Navigation überarbeitet.
- Dashboard-Flash-Meldungen als einheitliche Toast-Benachrichtigungen rechts oben umgesetzt und weitere Admin-Aktionen mit direktem Erfolgsfeedback versehen.

### Removed

- Alte CSV-Beispieldatei `web/prisma/data/mabila_eingabe_stadtwerke_delmenhorst.csv` entfernt.
- CSV-Matching- und Sample-Fact-Seeding aus `web/prisma/seed.ts` entfernt.
- Ungenutzte Prisma-Modelle `ImportRun` und `ImportError` entfernt; eine neue Migration droppt die alten Tracking-Tabellen.
- Interne Ops-Runbooks `infra/go-live-audit.md`, `infra/dokploy-setup.md` und `infra/db-sync.md` aus der öffentlichen Dokumentation entfernt.
- `web/prisma/generated/` aus Git entfernt und per `.gitignore` ausgeschlossen.
- Einmaliges Cleanup-Skript `web/scripts/cleanup-lineitems-by-sortorder.js` entfernt und JavaScript-Dateien in der TypeScript-Config explizit deaktiviert.
- Ungenutzte Tailwind-Toolchain entfernt: `tailwindcss`, `@tailwindcss/postcss`, `postcss.config.mjs` und Tailwind-`@theme`-Block.

## [1.1.1] - 2026-05-31

### Fixed

- CI-Install-Schritte robuster gemacht, damit ein transienter `esbuild`-Postinstall-Fehler (`ETXTBSY`) nicht den gesamten Workflow fehlschlagen lässt.
- `npm ci` in CI und Release-Workflow von `--prefer-offline` auf `--prefer-online` umgestellt, damit der npm-Cache validiert statt blind bevorzugt wird.
- Für den Format-Job `npm ci --ignore-scripts` verwendet, weil Prettier keine nativen Postinstall-Binaries benötigt und der Job dadurch weniger anfällig für Install-Races ist.
- Retry-Pfad für `npm ci` ergänzt: kurzer Wait, sauberes `node_modules`, `npm cache verify`, danach zweiter Install-Versuch.

### Changed

- App-Version und sichtbare Versionsanzeige auf `1.1.1` aktualisiert.
- README-Release-Beispiel auf generische Tag-Platzhalter umgestellt, damit die Dokumentation nicht bei jedem Patch-Release angepasst werden muss.

## [1.1.0] - 2026-05-31

### Changed

- PostgreSQL Docker Image von der bisherigen 16er Runtime auf `postgres:18.4-trixie` umgestellt.
- `PGDATA` in Dev- und Production-Compose explizit auf `/var/lib/postgresql/data` gesetzt, damit das PostgreSQL-18-Docker-Image nicht versehentlich ein anderes Datenverzeichnis initialisiert.
- App-Version auf `1.1.0` aktualisiert und Versionsanzeige im Footer/README angepasst.

### Upgraded

- PostgreSQL-Client-Tools in `app/Dockerfile` und `app/Dockerfile.dev` auf Version 18 aktualisiert, damit Backup/Restore mit einem PostgreSQL-18-Server kompatibel bleiben.
- Metabase Docker Image auf `v0.61.2.10`.
- `typescript-eslint` auf `^8.60.0`.
- `lucide-react` auf `^1.17.0`.

### Verified

- Production-kompatiblen Test-Dump erfolgreich in einem temporären `postgres:18.4-trixie` Container restored.
- Restore-Test: Serverversion `18.4 (Debian 18.4-1.pgdg13+1)`, 5 Hospitals, 8 Prisma-Migrationen.
- `docker compose config` für Dev und Prod erfolgreich.

### Operational Notes

- Bestehende PostgreSQL-16-Datenverzeichnisse können nicht direkt mit PostgreSQL 18 gestartet werden.
- Vor dem automatischen Dokploy-Redeploy muss die Production-DB kontrolliert auf PostgreSQL 18.4 migriert sein oder der Autodeploy für dieses Deployment pausiert werden.
- Metabase verwendet ein eigenes Volume und darf beim Dev-/Production-DB-Upgrade nicht mit `down -v` oder globalem Volume-Prune gelöscht werden.

## [1.0.0] - 2026-05-26

### Highlights

- Modernisierte Landing Page mit responsivem Explorer, Light-/Dark-Mode, weicher Theme-Animation und konsistenter Branding-Nutzung.
- Neues gemeinsames Dashboard-UI-Set für wiederverwendbare Page-, Header-, Card-, Button-, Field- und Notice-Komponenten.
- Deutlich aufgeräumtere Dashboard-Architektur durch Auslagerung von Auth-/Role-Guards, Faktenlogik, Statement-Berechnung, Backup-Modulen, Metabase-Helfern und Validierung.
- Upgrade auf aktuelle Plattformversionen: Node.js 24, Next.js 16, React 19, TypeScript 6, ESLint 10 und Prisma 7.
- Neue Tests für zentrale Domainlogik und CI mit getrennten Checks für Lint, Typecheck, Tests, Format und Build.
- Release-Automation: Tags im Format `v*` auf `master` erzeugen einen GitHub Release.

### Added

- `CHANGELOG.md` als zentrale Release-Historie.
- GitHub Actions Workflow `.github/workflows/release.yml`:
  - läuft bei Tags `v*`
  - prüft, dass der Tag auf der `master`-Historie liegt
  - führt `lint`, `typecheck`, `test`, `prettier --check` und `next build` aus
  - erstellt anschließend einen GitHub Release mit dem Tag-Namen als Release-Namen
- App-Version `1.0.0` in `app/package.json`, `app/package-lock.json` und `app/lib/version.ts`.
- Versionsanzeige `v1.0.0` im Footer der Landing Page.
- Neue zentrale Zugriffsschicht:
  - `app/lib/access.ts`
  - `app/lib/roles.ts`
  - wiederverwendbare Role-Guards wie Admin- und Editor-Zugriff
- Neue zentrale Validierung mit Zod:
  - `app/lib/validation.ts`
  - validierte Rollen, Jahre, Statement Types, Search Params und Formwerte
- Neue Fakten-Domainmodule:
  - `app/lib/facts/saveFacts.ts`
  - `app/lib/facts/statementRows.ts`
  - `app/lib/facts/numberFormat.ts`
  - `app/lib/facts/numberParsing.ts`
  - `app/lib/facts/loadStatementContext.ts`
  - `app/lib/facts/periods.ts`
  - `app/lib/facts/types.ts`
- Neues Dashboard-UI-Set:
  - `DashboardPage`
  - `DashboardHeader`
  - `DashboardCard`
  - `DashboardGrid`
  - `DashboardField`
  - `DashboardActions`
  - `DashboardButton`
  - `DashboardButtonLink`
  - `DashboardNotice`
- Gemeinsame Auth-Shell für Login und Logout:
  - `app/app/_components/AuthShell.tsx`
  - `app/app/_components/AuthShell.module.css`
- Konsolidierte Logo- und Icon-Assets unter `app/public/assets`.
- Favicon/App-Icon über das neue Hospitalinsights-Icon.
- Metabase-Helfer `app/lib/metabase.ts` für:
  - Katalog-Parsing
  - erlaubte Views
  - Landing-Views
  - JWT Embed URLs
- Backup-Unterstruktur:
  - `app/lib/backup/process.ts`
  - `app/lib/backup/lock.ts`
  - `app/lib/backup/postgres.ts`
  - `app/lib/backup/files.ts`
  - `app/lib/backup/types.ts`
- Vitest-Konfiguration und Tests:
  - `app/vitest.config.ts`
  - `app/lib/facts/numberParsing.test.ts`
  - `app/lib/facts/saveFacts.test.ts`
  - `app/lib/facts/statementRows.test.ts`
  - `app/lib/metabase.test.ts`
  - `app/lib/dbBackups.test.ts`

### Changed

- Landing Page:
  - Navigation von `Explorer/Vergleich` auf verständlichere Bereiche wie Auswahl und Ausgabe angepasst.
  - Vergleichsmodus visuell geglättet und responsiver gemacht.
  - Theme-Toggle repariert und mit weicher Übergangsanimation versehen.
  - Footer kompakter gehalten und um Versionsanzeige ergänzt.
- Dashboard:
  - Dashboard-Seiten verwenden nun ein gemeinsames UI-System.
  - Karten, Buttons, Inputs, Selects, Notices und Header sind konsistenter gestaltet.
  - Dashboard-Übersicht, Datenverwaltung, Hospitalverwaltung, Benutzerverwaltung, Audit, Audit-Management, Audit-Details, Backups und Forbidden Page wurden visuell vereinheitlicht.
- Login/Logout:
  - Login und Logout nutzen eine gemeinsame Auth-Shell.
  - Logo, Startseitenlink, Card-Positionierung und Scrollverhalten wurden vereinheitlicht.
  - Weißer Browser-Default-Rand durch globales `body { margin: 0 }` entfernt.
  - Wordmark-Asset wird im Auth-Header sauber gecroppt, damit der eingebaute PNG-Leerraum nicht wie Layout-Abstand wirkt.
- Datenverwaltung:
  - `dashboard/data/page.tsx` wurde stark verkleinert.
  - Server Actions, Statement-Kontext, Periodenerstellung, Statement-Zeilen und Zahlenformatierung liegen jetzt in Domainmodulen.
  - Eingabetabelle nutzt weiterhin spezifische Tabellenlogik, aber Buttons und Controls sind stärker vereinheitlicht.
- Hospitalverwaltung:
  - Löschen von Krankenhäusern und Jahren nutzt Confirm-Buttons.
  - Serverseitige `confirmed=1` Prüfung ergänzt, damit Client-Confirm nicht die einzige Absicherung ist.
- Audit:
  - Audit-Filter nutzen gemeinsame Input-/Select-Styles.
  - Admin-Löschaktionen verwenden Confirm-Buttons.
  - Management- und Detailseiten wurden auf gemeinsame Dashboard-Komponenten umgestellt.
- Backups:
  - `dbBackups.ts` wurde in fokussierte Module aufgeteilt.
  - Backup-UI nutzt gemeinsame Dashboard-Buttons und Cards.
  - Ungenutzte Restore-Funktion wurde entfernt.
- Metabase:
  - Doppelte Katalog- und JWT-Logik in Landing Page und Embed-Routen wurde zentralisiert.
  - `jsonwebtoken` wurde durch `jose` ersetzt.
  - `@types/jsonwebtoken` ist nicht mehr nötig.
- README:
  - Veröffentlichungstauglicher neu strukturiert.
  - Badges, Quickstart, Architektur, Qualitätssicherung, Production-Hinweise und Release-Status ergänzt.
- CI:
  - Workflow läuft für Pull Requests auf `develop` und `master` sowie Pushes auf `master`.
  - Jobs sind in `lint`, `typecheck`, `test`, `format` und `build` aufgeteilt.
  - Node.js Version auf 24.16.0 aktualisiert.

### Upgraded

- Node Docker Images auf Node.js 24 Alpine.
- Prisma ORM auf Prisma 7 mit `@prisma/adapter-pg`.
- TypeScript auf `^6.0.3`.
- ESLint auf `^10.4.0` und Flat-Config-kompatible Konfiguration.
- Next.js, React, React DOM, Tailwind-Pakete, Node-Typen und weitere Tooling-Abhängigkeiten auf aktuelle Versionen.
- Metabase Docker Tag auf `v0.61.2.8`.

### Removed

- Veraltete Next.js Default-SVGs:
  - `app/public/file.svg`
  - `app/public/globe.svg`
  - `app/public/next.svg`
  - `app/public/vercel.svg`
  - `app/public/window.svg`
- Alte Logo-Assets unter `app/assets`.
- Kurze doppelte `app/README.md`; die Root-README ist jetzt die zentrale Projektdokumentation.
- Alte Login-/Logout-spezifische CSS-Module zugunsten der gemeinsamen Auth-Shell.
- Ungenutzte Backup-Restore-Funktion, die nicht vom UI-Pfad verwendet wurde.
- Nicht mehr genutzte Validierungshelfer.
- Prisma Generated Files aus automatischer Formatierung.

### Security

- Rollenprüfungen wurden zentralisiert und serverseitig konsistenter gemacht.
- Admin-/Editor-Zugriffe werden in Pages, Actions und API-Routen über gemeinsame Guards abgesichert.
- Kritische Löschaktionen verwenden Confirm-Buttons und serverseitige Bestätigungsfelder.
- Metabase Embed URLs werden serverseitig erzeugt und erlaubte Views werden validiert.
- Backup-Dateinamen und Import-/Download-Pfade werden stärker validiert.

### Testing

- Neue Tests für:
  - detailliertes Zahlenparsing
  - Change-Erkennung beim Speichern von Fakten
  - Statement-Tree- und Formel-Berechnung
  - Metabase-Katalog-Parsing
  - Backup-Dateinamen-Sicherheit
- Tests laufen in CI und lokal über `npm test`.

### Operational Notes

- Production-Migrationen sollten mit `prisma migrate deploy` ausgeführt werden.
- Für Prisma 7 muss `DATABASE_URL` über `prisma.config.ts` verfügbar sein.
- Node.js 24 ist die Zielruntime für Docker, CI und lokale Entwicklung.

<p align="center">
  <img src="app/public/assets/hospitalinsights-logo-with-text.png" alt="Hospitalinsights" width="520">
</p>

<h1 align="center">Hospitalinsights</h1>

<p align="center">
  Datenbasierte Krankenhausanalyse, Benchmarking und BI-Embedding für operative und finanzielle Kennzahlen.
</p>

<p align="center">
  <img alt="Version 1.0.0" src="https://img.shields.io/badge/Version-v1.0.0-111827?style=for-the-badge">
  <img alt="Node.js 24" src="https://img.shields.io/badge/Node.js-24-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white">
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-149ECA?style=for-the-badge&logo=react&logoColor=white">
  <img alt="TypeScript 6" src="https://img.shields.io/badge/TypeScript-6-3178C6?style=for-the-badge&logo=typescript&logoColor=white">
  <img alt="Prisma 7" src="https://img.shields.io/badge/Prisma-7-2D3748?style=for-the-badge&logo=prisma&logoColor=white">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16+-4169E1?style=for-the-badge&logo=postgresql&logoColor=white">
  <img alt="Docker" src="https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white">
</p>

## Überblick

Hospitalinsights ist eine Web-Plattform für die strukturierte Aufbereitung, Pflege und Auswertung von Krankenhauskennzahlen. Jahresabschlüsse, Bilanzpositionen und operative Kennzahlen werden in PostgreSQL modelliert, über ein geschütztes Dashboard gepflegt und öffentlich über kontrolliertes Metabase Signed Embedding visualisiert.

Die Anwendung ist auf einen klaren Betriebsfluss ausgelegt: Datenpflege durch Admins/Editoren, Auditierbarkeit aller Änderungen, Backup-/Restore-Werkzeuge und eine moderne Landing Page mit auswählbaren Analyseansichten.

## Highlights

- Öffentliches Analyseportal mit Einzel- und Vergleichsansichten
- Geschütztes Dashboard für Datenpflege, Benutzer, Krankenhäuser und Audit Log
- Rollenmodell für `ADMIN` und `EDITOR`
- Prisma ORM mit versionierten Migrationen
- Metabase Signed Embedding über serverseitig erzeugte JWT-URLs
- Backup-, Upload-, Import- und Restore-Workflows für PostgreSQL-Dumps
- Responsive UI mit Light-/Dark-Mode auf der Landing Page

## Architektur

```text
HospitalInsights/
├─ app/                         Next.js App Router Anwendung
│  ├─ app/                       Pages, API Routes, Komponenten
│  ├─ lib/                       Domainlogik, Auth, Prisma, Metabase, Backups
│  ├─ prisma/                    Schema, Migrationen, Seed, generierter Client
│  └─ public/assets/             Logo- und App-Assets
├─ infra/                        Docker Compose, Nginx Dev-Proxy, Env-Templates
└─ .github/workflows/ci.yml      CI Pipeline
```

## Tech Stack

| Bereich     | Technologie                         |
| ----------- | ----------------------------------- |
| Web App     | Next.js 16, React 19, TypeScript 6  |
| Styling     | CSS Modules, Tailwind CSS Toolchain |
| Auth        | NextAuth Credentials Provider       |
| Datenbank   | PostgreSQL                          |
| ORM         | Prisma 7 mit PostgreSQL Adapter     |
| BI          | Metabase Signed Embedding           |
| Validierung | Zod                                 |
| Tests       | Vitest                              |
| Runtime     | Node.js 24, Docker Compose          |

## Quickstart

### Voraussetzungen

- Docker Desktop mit Compose v2
- Git

### 1. Repository vorbereiten

```powershell
git clone https://github.com/Lp04-Bruno/HospitalInsights.git
cd HospitalInsights
Copy-Item infra/.env.example infra/.env
```

Für Bash:

```bash
git clone https://github.com/Lp04-Bruno/HospitalInsights.git
cd HospitalInsights
cp infra/.env.example infra/.env
```

### 2. Dev-Stack starten

```bash
docker compose --env-file infra/.env -f infra/docker-compose.dev.yml up -d --build
```

### 3. Datenbank migrieren und seeden

```bash
docker compose --env-file infra/.env -f infra/docker-compose.dev.yml exec -T app npx prisma migrate deploy
docker compose --env-file infra/.env -f infra/docker-compose.dev.yml exec -T app npx prisma db seed
```

### 4. Anwendung öffnen

| Ziel                 | URL                               |
| -------------------- | --------------------------------- |
| Portal               | `http://localhost:3000`           |
| Sign-in              | `http://localhost:3000/signin`    |
| Dashboard            | `http://localhost:3000/dashboard` |
| Metabase UI          | `http://localhost:3001`           |
| PostgreSQL Host-Port | `localhost:5433`                  |

## Dev Credentials

Der Seed legt für lokale Entwicklung einen Admin an:

```text
Email:    admin@hospitalinsights.local
Passwort: admin1234
```

Diese Credentials sind ausschließlich für lokale Entwicklung gedacht. In Production sollten initiale Admin-Zugänge über `SEED_ADMIN_EMAIL` und `SEED_ADMIN_PASSWORD` gesetzt und anschließend rotiert werden.

## Lokaler Workflow

Alle Compose-Kommandos werden aus dem Repository-Root ausgeführt.

```bash
# Start oder Rebuild
docker compose --env-file infra/.env -f infra/docker-compose.dev.yml up -d --build

# App Logs
docker compose --env-file infra/.env -f infra/docker-compose.dev.yml logs -f app

# Nur App neu starten
docker compose --env-file infra/.env -f infra/docker-compose.dev.yml restart app

# Stack stoppen, Volumes behalten
docker compose --env-file infra/.env -f infra/docker-compose.dev.yml down

# Komplett-Reset inklusive DB und Metabase Volume
docker compose --env-file infra/.env -f infra/docker-compose.dev.yml down -v
```

## Entwicklung ohne Compose

```bash
cd app
npm ci
npm run generate
npm run dev
```

Für lokale Ausführung außerhalb von Docker muss `DATABASE_URL` auf eine erreichbare PostgreSQL-Instanz zeigen.

## Qualitätssicherung

Die CI führt dieselben Basisprüfungen aus, die lokal empfohlen sind:

```bash
cd app
npm run lint
npm run typecheck
npm test
npm exec -- prettier --ignore-path ../.prettierignore --check ..
npm run build
```

GitHub Actions laufen bei Pull Requests gegen `develop` und `master` sowie bei Pushes auf `master`.

## Releases

Releases werden über Git Tags auf `master` erstellt. Tags im Format `v*` starten den Release-Workflow, führen die Qualitätschecks aus und erzeugen anschließend einen GitHub Release mit dem Tag-Namen als Release-Namen.

```bash
git checkout master
git pull origin master
git tag v1.0.0
git push origin v1.0.0
```

Die Release-Historie steht in [CHANGELOG.md](CHANGELOG.md).

## Metabase Signed Embedding

### Dev Setup

1. Metabase unter `http://localhost:3001` öffnen und Admin anlegen.
2. PostgreSQL Datenbank hinzufügen:

```text
Host:     db
Port:     5432
Database: hospitalinsights
User:     hospitalinsights
Password: hospitalinsights_pw
```

3. In Metabase unter `Admin -> Settings -> Embedding`:

- Embedding Secret generieren
- Guest Embeds aktivieren
- Secret als `METABASE_EMBED_SECRET` in `infra/.env` setzen

4. Dashboard oder Question erstellen und die ID aus der URL übernehmen.

```env
METABASE_DASHBOARD_ID=2
```

Optional kann ein Katalog für mehrere Landing-Page-Ansichten gesetzt werden:

```env
METABASE_DASHBOARD_CATALOG=[{"type":"question","id":38,"name":"Top Metrics Latest Year"}]
```

### Dev CSP Proxy

Metabase liefert für Embed-Routen restriktive CSP-Header. Im Dev-Stack läuft Metabase deshalb hinter einem kleinen Nginx-Proxy, der diese Header entfernt. Das ist nur für lokale Entwicklung gedacht.

```text
infra/nginx.metabase.dev.conf
```

## Rollen und Zugriff

| Rolle    | Zugriff                                                     |
| -------- | ----------------------------------------------------------- |
| `ADMIN`  | Dashboard, Datenpflege, Audit Management, Benutzer, Backups |
| `EDITOR` | Dashboard, Datenpflege, Audit Log, Hospitalverwaltung       |

## Production Hinweise

Für Production sollten mindestens diese Punkte gesetzt oder geprüft sein:

- `NEXTAUTH_SECRET` als starkes Secret
- `NEXTAUTH_URL` mit der öffentlichen URL
- `DATABASE_URL` als direkte PostgreSQL-Verbindung
- `METABASE_EMBED_SECRET` passend zur Production-Metabase-Instanz
- `BACKUP_ENABLED` und `BACKUP_RESTORE_ENABLED` bewusst konfigurieren
- Keine Dev-Credentials oder Demo-Secrets verwenden
- Metabase ohne Dev-CSP-Proxy betreiben
- Migrationen mit `prisma migrate deploy` ausführen

Production-relevante Artefakte:

| Datei                           | Zweck                            |
| ------------------------------- | -------------------------------- |
| `app/Dockerfile`                | Production Build der Next.js App |
| `app/Dockerfile.dev`            | Development Container            |
| `infra/docker-compose.prod.yml` | Production Compose Template      |
| `infra/.env.prod.example`       | Production Env Template          |

## Datenbank und Backups

Hospitalinsights bringt Admin-Werkzeuge für PostgreSQL-Dumps mit. Je nach Env-Konfiguration können Backups erstellt, heruntergeladen, hochgeladen, analysiert und wiederhergestellt oder importiert werden.

Metabase nutzt in Development ein eigenes Volume `metabase_data`, damit Metabase-interne Daten von der App-Datenbank getrennt bleiben.

Für kontrollierten Production-to-Development Sync:

- [infra/db-sync.md](infra/db-sync.md)

## Migrationen

Development:

```bash
docker compose --env-file infra/.env -f infra/docker-compose.dev.yml exec -T app npx prisma migrate dev
```

Production:

```bash
npx prisma migrate deploy
```

`migrate deploy` ist für Production gedacht und führt vorhandene Migrationen aus, ohne neue Migrationen zu erzeugen.

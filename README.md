# HospitalInsights

HospitalInsights ist eine Web-Plattform, die Jahresabschlüsse/Bilanzen von Krankenhäusern verständlich aufbereitet und vergleichbar macht (Benchmarking).

## Dev-Stack

- Next.js (App Router) als Portal (öffentlich + Admin/Editor Bereiche)
- PostgreSQL (Docker) als zentrale Datenbank
- Prisma für Schema/Migrations/Seed
- Metabase als BI (Dashboards) direkt auf Postgres
- Öffentliche Darstellung über kontrolliertes Metabase Signed Embedding

## Quickstart (lokal, Development)

Voraussetzungen:

- Docker Desktop (Compose v2)
- Git

1. Env-Datei anlegen:

- PowerShell: `Copy-Item infra/.env.example infra/.env`
- Bash: `cp infra/.env.example infra/.env`

2. Stack starten:

- `docker compose --env-file infra/.env -f infra/docker-compose.dev.yml up -d --build`

3. Migration + Seed (einmalig oder nach Reset):

- `docker compose --env-file infra/.env -f infra/docker-compose.dev.yml exec -T app npx prisma migrate deploy`
- `docker compose --env-file infra/.env -f infra/docker-compose.dev.yml exec -T app npx prisma db seed`

4. Öffnen:

- App: `http://localhost:3000`
- Sign-in: `http://localhost:3000/signin`
- Metabase UI: `http://localhost:3001`

## Wichtige URLs (Dev)

- App (Portal): `http://localhost:3000`
- Dashboard (geschützt): `http://localhost:3000/dashboard`
- Metabase UI (Dev): `http://localhost:3001`
- Postgres (Host-Port): `localhost:5433`

## Default Admin (Dev-only, NextAuth Credentials)

- Email: `admin@hospitalinsights.local`
- Passwort: `admin1234`

In Production keine festen Default-Credentials verwenden.
Wenn ihr initial einen Admin anlegen wollt, setzt `SEED_ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD` und führt danach `prisma db seed` aus.

## Entwickler-Workflow (Start/Stop/Restart)

Compose-Kommandos immer aus dem Repo-Root ausführen.

- Start/Rebuild: `docker compose --env-file infra/.env -f infra/docker-compose.dev.yml up -d --build`
- Logs (App): `docker compose --env-file infra/.env -f infra/docker-compose.dev.yml logs -f app`
- Restart nur App: `docker compose --env-file infra/.env -f infra/docker-compose.dev.yml restart app`
- Stop (Container aus, Volumes behalten): `docker compose --env-file infra/.env -f infra/docker-compose.dev.yml down`
- Komplett-Reset (DB + Metabase Setup löschen!): `docker compose --env-file infra/.env -f infra/docker-compose.dev.yml down -v`

## Metabase (Signed Embedding) – Setup (Dev)

1. Metabase öffnen: `http://localhost:3001` und Admin anlegen (Dummy-Mail ist ok)
2. Datenbank hinzufügen (Postgres):

- Host: `db`
- Port: `5432`
- Database: `hospitalinsights`
- User: `hospitalinsights`
- Password: `hospitalinsights_pw`

3. Admin → Settings → Embedding:

- "Embedding secret key" setzen (Metabase generieren und in `infra/.env` als `METABASE_EMBED_SECRET` eintragen)
- "Enable guest embeds" aktivieren

4. Dashboard/Question erstellen und ID merken (URL enthält z.B. `/dashboard/2-...` → ID=2)
5. In `infra/.env` setzen:

- `METABASE_DASHBOARD_ID=2`
- optional: `METABASE_DASHBOARD_CATALOG=[{"type":"question","id":38,"name":"..."}]`

## Hinweis: CSP-Warnungen im Browser (Dev)

Metabase liefert für `/embed/...` eine restriktive CSP aus. Im Dev-Stack läuft Metabase daher hinter einem kleinen Nginx-Proxy auf `http://localhost:3001`, der CSP-Header entfernt (nur Dev).
Datei: `infra/nginx.metabase.dev.conf` (nicht für Production verwenden).

## Rollen & Zugriff (Dev)

- `/dashboard` ist geschützt: nur `ADMIN` und `EDITOR`.

## Dev vs Production (Kurzüberblick)

Für Production:

- eigene Compose-Datei (z.B. `infra/docker-compose.prod.yml`) + eigenes Env
- `next build` + `next start` (statt `next dev`)
- echte Secrets (`NEXTAUTH_SECRET`, `METABASE_EMBED_SECRET`) und echte `NEXTAUTH_URL`
- Metabase in Production ohne den Dev-Proxy betreiben

Production Artefakte im Repo:

- App Dockerfile (Prod): `app/Dockerfile`
- App Dockerfile (Dev): `app/Dockerfile.dev`
- Prod Compose Template: `infra/docker-compose.prod.yml`
- Prod Env Template: `infra/.env.prod.example`

## Metabase Datenhaltung (Dev)

Metabase nutzt ein eigenes Volume `metabase_data` (interne Metabase DB). Dadurch bleibt die App-Datenbank sauber für Prisma-Migrations.

## Prod → Dev DB Sync

Wenn ihr Produktionsdaten lokal zum Testen nutzen wollt, macht das als kontrollierten Dump/Restore Workflow (Postgres `pg_dump` → lokal `pg_restore`).

- Anleitung: [infra/db-sync.md](infra/db-sync.md)

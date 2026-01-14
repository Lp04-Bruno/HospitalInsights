# HospitalInsights

HospitalInsights ist eine Web-Plattform, die Jahresabschlüsse/Bilanzen von Krankenhäusern verständlich aufbereitet und vergleichbar macht (Benchmarking).

Dev-Stack:
- Next.js (App Router) als Portal (öffentlich + Admin/Editor Bereiche)
- PostgreSQL als zentrale Datenbank
- Prisma für Schema/Migrations/Import-Pipelines
- Metabase als BI (Dashboards) direkt auf Postgres
- Öffentliche Darstellung über kontrolliertes Metabase Signed Embedding (Metabase bleibt idealerweise intern)

**Quickstart (lokal, Development)**
- Voraussetzungen installieren: Docker Desktop (Compose v2), Git
- Env-Datei anlegen:
  - `cp infra/.env.example infra/.env`
- Stack starten:
  - `docker compose -f infra/docker-compose.dev.yml up -d --build`
- Migration/Seed (einmalig oder nach Reset):
  - `docker compose -f infra/docker-compose.dev.yml exec app npx prisma migrate deploy`
  - `docker compose -f infra/docker-compose.dev.yml exec app npx prisma db seed`
- Öffnen:
  - App: `http://localhost:3000`
  - Sign-in: `http://localhost:3000/signin`
  - Metabase UI: `http://localhost:3001`

**Wichtige URLs (Dev)**
- App (Portal): `http://localhost:3000`
- Metabase UI (Admin/BI): `http://localhost:3001`
- Postgres (Host-Port): `localhost:5432`
- Embed API (Next.js): `http://localhost:3000/api/metabase/embed/dashboard/:dashboardId`

**Metabase initial einrichten (Signed Embedding)**
1. Öffnen: `http://localhost:3001` und Admin anlegen (Dummy-Mail ist ok für lokales Dev)
2. Datenbank hinzufügen (Postgres):
   - Host: `db`
   - Port: `5432`
   - Database: `hospitalinsights`
   - User: `hospitalinsights`
   - Password: `hospitalinsights_pw`
3. Admin → Settings → Embedding:
   - "Embedding secret key" setzen (entweder in Metabase generieren und in `infra/.env` setzen)
   - "Enable guest embeds" aktivieren (sonst zeigt das iFrame ggf. „Embedding is not enabled…“)
4. Dashboard erstellen und ID merken (z.B. URL enthält `/dashboard/2-...` → ID=2)
5. Dashboard-ID in `infra/.env` setzen:
   - `METABASE_DASHBOARD_ID=2`

**Default Admin (NextAuth Credentials)**
- Email: `admin@hospitalinsights.local`
- Passwort: `admin1234`

**Entwickler-Workflow (Start/Stop/Restart)**
- Start/Rebuild: `docker compose -f infra/docker-compose.dev.yml up -d --build`
- Logs: `docker compose -f infra/docker-compose.dev.yml logs -f app`
- Restart nur App: `docker compose -f infra/docker-compose.dev.yml restart app`
- Stop (Container aus, Volumes behalten): `docker compose -f infra/docker-compose.dev.yml down`
- Komplett-Reset (DB + Metabase Setup löschen!): `docker compose -f infra/docker-compose.dev.yml down -v`

**Dev vs Production - Konzept**
Aktuell ist dieses Repo auf lokalen Dev ausgelegt.

Für später „Production“ empfiehlt sich:
- Separate Compose-Datei (z.B. `infra/docker-compose.prod.yml`) + eigenes Env (z.B. `infra/.env.prod`)
- Keine Bind-Mounts (kein `../app:/app`), stattdessen gebautes Image
- `next build` + `next start` (statt `next dev`)
- Echte Secrets (`NEXTAUTH_SECRET`, `METABASE_EMBED_SECRET`) und echte `NEXTAUTH_URL`
- Metabase idealerweise nicht öffentlich exponieren (oder nur intern/VPN), Embedding weiter über Signed Embedding

**Hinweis: Metabase Accounts & Contributors (lokales Dev)**
- Jeder Contributor hat lokal seine eigene Metabase-Instanz (Docker Volume `metabase_data`) → eigene User/Passwörter.
- Dummy-Mails (z.B. `dev@local.test`) sind für lokale Tests völlig ausreichend.

**Wichtiger Hinweis (DB Trennung)**
Metabase nutzt eine eigene interne DB (Volume `metabase_data`). So bleibt die App-Datenbank frei von Metabase-Systemtabellen und Prisma-Migrations funktionieren sauber.

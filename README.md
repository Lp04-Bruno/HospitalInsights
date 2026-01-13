# HospitalInsights

HospitalInsights ist eine lokale Dev-Umgebung für ein Next.js (App Router) + Prisma + Postgres Setup mit NextAuth Credentials-Login und Metabase (Signed Embedding).

## Features

- Next.js App unter `http://localhost:3000`
- Postgres DB (App-Daten) unter `localhost:5432`
- Metabase UI unter `http://localhost:3001`
- NextAuth Credentials Sign-In unter `/signin`
- Metabase Signed Embed Endpoint unter `/api/metabase/embed/dashboard/:dashboardId`

## Voraussetzungen

- Docker Desktop (Compose v2)

## Start (Development)

Im Repo-Root:

1) Env-Datei anlegen:

```bash
cp infra/.env.example infra/.env
```

```bash
docker compose -f infra/docker-compose.dev.yml up -d --build
```

Logs checken (optional):

```bash
docker compose -f infra/docker-compose.dev.yml logs -f app
```

## Prisma (Migration & Seed)

Die App nutzt Postgres im Container (Service `db`).

Migration ausführen:

```bash
docker compose -f infra/docker-compose.dev.yml exec app npx prisma migrate dev
```

Admin-User seeden:

```bash
docker compose -f infra/docker-compose.dev.yml exec app npx prisma db seed
```

Default Admin:

- Email: `admin@hospitalinsights.local`
- Passwort: `admin1234`

## Metabase konfigurieren

1. Öffnen: `http://localhost:3001`
2. Metabase Admin anlegen
3. "Add database" → Postgres
   - Host: `db`
   - Port: `5432`
   - Database: `hospitalinsights`
   - User: `hospitalinsights`
   - Password: `hospitalinsights_pw`
4. Admin Settings → Embedding
   - Enable embedding ✅
   - Enable signed embedding ✅
   - Secret: `METABASE_EMBED_SECRET` (gesetzt in `.env`)

Dashboard-ID merken und ggf. die ID in `app/app/page.tsx` anpassen.

## Wichtiger Hinweis (DB Trennung)

Metabase nutzt eine eigene interne DB (Volume `metabase_data`). So bleibt die App-Datenbank frei von Metabase-Systemtabellen und Prisma Migrations funktionieren sauber.

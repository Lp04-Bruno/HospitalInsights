# Go-Live Audit (Kurz-Checkliste)

Diese Liste ist auf das aktuelle Setup (Next.js + Prisma + Postgres + Metabase + Dokploy/Traefik) zugeschnitten.

## 1) Secrets (Pflicht)

- In Dokploy setzen/rotieren (nicht im Repo speichern):
  - `POSTGRES_PASSWORD`
  - `NEXTAUTH_SECRET`
  - `METABASE_EMBED_SECRET`

Praktisch zum Generieren (lokal/VPS):

- `openssl rand -hex 32`

## 2) Domains / HTTPS

- Portal: `https://hospitalinsights.de`
- Metabase: `https://metabase.hospitalinsights.de`
- Prüfen: Zertifikate aktiv, Redirect HTTP→HTTPS.

## 3) Netzwerk / Ports

- DB-Port `5432` nicht öffentlich mappen.
- Metabase nur über Subdomain routen (optional IP-restrict/VPN).

## 4) Migrationen

- Production nutzt nur `prisma migrate deploy` (läuft im App-Entrypoint).
- Nach einem Deploy prüfen:
  - App startet sauber
  - `/_prisma_migrations` ist aktuell

## 5) Health / Readiness

- App-Health prüfen: `GET https://hospitalinsights.de/api/health`
  - Erwartet: `200` und `{ status: "ok", db: "ok" }`

## 6) Metabase Embedding

- Metabase Admin → Settings → Embedding:
  - Guest embeds aktiv
  - Secret Key gesetzt
- App Env:
  - `METABASE_SITE_URL=https://metabase.hospitalinsights.de`
  - `METABASE_EMBED_SECRET=...`
  - `METABASE_DASHBOARD_ID` oder `METABASE_DASHBOARD_CATALOG`

## 7) Backups + Restore-Test

- Mindestens täglich: `pg_dump` erzeugen und extern speichern.
- Einmal Restore-Test durchführen (separate Test-DB oder lokal) und App-Start verifizieren.

## 8) Prod-like Test lokal

- `cp infra/.env.prod.example infra/.env.prod`
- `docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml up -d --build`
- Danach:
  - `docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml logs -f app`
  - `curl http://localhost:3000/api/health`

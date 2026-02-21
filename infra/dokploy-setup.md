# Dokploy Setup (hospitalinsights.de)

Ziel-Domains:

- Portal (Next.js): `https://hospitalinsights.de`
- Metabase: `https://metabase.hospitalinsights.de`
- Dokploy: `https://dokploy.hospitalinsights.de`

## Empfohlenes Setup: 1 Dokploy Project/Stack mit Compose

Am einfachsten und robustesten ist ein einzelner Stack mit `infra/docker-compose.prod.yml`.
Dann funktionieren interne Hostnames (`db`, `metabase`) genauso wie lokal.

### 1) Services

- `db` (Postgres)
  - **Nicht** öffentlich exposen (kein Host-Port)
  - Persistentes Volume: `pg_data`
- `metabase`
  - Intern erreichbar für die App, extern über Traefik auf `metabase.hospitalinsights.de`
  - Persistentes Volume: `metabase_data`
- `app` (Next.js)
  - Build aus Repo: `app/Dockerfile`
  - Läuft auf Port `3000` im Container; Traefik routet auf `hospitalinsights.de`
  - Start führt `prisma migrate deploy` aus (Entrypoint)

### 2) Routing / Domains (Traefik)

- Route `hospitalinsights.de` → Service `app` → Port `3000`
- Route `metabase.hospitalinsights.de` → Service `metabase` → Port `3000`
- DB bekommt **keine** Route

### 3) Environment Variables (Dokploy)

Setzt diese Variablen als Dokploy Env/Secrets (nicht im Repo):

**Postgres**

- `POSTGRES_DB=hospitalinsights`
- `POSTGRES_USER=hospitalinsights`
- `POSTGRES_PASSWORD=<starkes-passwort>`

**App (NextAuth + Prisma + Metabase Embed)**

- `DATABASE_URL=postgresql://hospitalinsights:<pw>@db:5432/hospitalinsights?schema=public`
- `NEXTAUTH_URL=https://hospitalinsights.de`
- `NEXTAUTH_SECRET=<starker-random-secret>`
- `METABASE_SITE_URL=https://metabase.hospitalinsights.de`
- `METABASE_EMBED_SECRET=<aus-metabase-admin-embedding>`
- `METABASE_DASHBOARD_ID=<id>`
- Optional: `METABASE_DASHBOARD_CATALOG=<json>`
- Optional: `METABASE_EMBED_HOSPITAL_PARAM=hospitalId`

**Metabase (Einrichtung)**

- Metabase UI öffnen: `https://metabase.hospitalinsights.de`
- Admin erstellen
- DB verbinden (Host: `db`, Port: `5432`, DB/User/PW wie oben)
- Admin → Settings → Embedding: Guest embeds aktivieren + Secret Key setzen/lesen

### 4) Ports, die ihr NICHT öffnen solltet

- **Kein** `5432` nach außen
- Metabase nur über `metabase.hospitalinsights.de` (HTTPS) – optional IP-restrict/VPN, wenn ihr es nicht “öffentlich” haben wollt

### 5) Backups (Minimum)

- Regelmäßig `pg_dump` der Prod-DB und extern speichern.
- Vor Deploys (oder täglich) Snapshot ziehen.

**Praktische Minimal-Strategie (ohne DB-Port nach außen):**

- In [infra/docker-compose.prod.yml](infra/docker-compose.prod.yml) ist im DB-Service ein Backup-Volume `/backups` vorgesehen.
- Erzeugt Dumps direkt im DB-Container (z.B. via Dokploy Exec oder per SSH auf den Host):
  - `pg_dump -U $POSTGRES_USER -d $POSTGRES_DB -Fc -f /backups/prod_$(date +%F).dump`
- Kopiert die Dumps anschließend extern weg (S3/Storage/Backup-Server).

**Restore-Test (mindestens 1x vor Live):**

- In einer separaten Test-DB (oder lokal) einen Dump mit `pg_restore` einspielen und prüfen, ob App startet.

## Alternative: 3 getrennte Dokploy Apps

Geht auch, aber dann müsst ihr sicherstellen, dass alle Container im selben Docker-Netz sind und `DATABASE_URL` korrekt auf den DB-Service zeigt.

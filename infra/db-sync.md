# Prod → Dev DB Sync (Postgres)

Ziel: Produktionsdaten in die lokale Dev-DB übernehmen, ohne Prisma-Migrations oder Docker-Volumes zu “verbiegen”.

## Grundprinzip

- **Prod** läuft als Postgres-Container in Dokploy mit persistentem Volume.
- **Sync** bedeutet: **Dump erzeugen** (`pg_dump`) → **lokal wiederherstellen** (`pg_restore`).
- Prisma-Migrations bleiben dabei korrekt, weil die Tabellen inklusive `_prisma_migrations` mitgesichert werden.

> Hinweis: Daten-Sync ist technisch einfach, aber organisatorisch heikel (Zugriff/PII). Wenn das ok ist, nutzt trotzdem mindestens: SSH, sichere Passwörter, Dumps nicht unverschlüsselt liegen lassen.

## Variante A (empfohlen): Dump via SSH-Tunnel, Restore lokal

Diese Variante braucht **keinen** öffentlich erreichbaren Postgres-Port auf dem VPS.

1. **SSH-Tunnel** aufbauen (Beispiel: Postgres läuft auf dem VPS nur intern auf `127.0.0.1:5432` oder in Docker-Netz):

   - Auf eurem Rechner:
     - `ssh -L 55432:127.0.0.1:5432 <user>@<vps-host>`

2. **Dump erstellen** (custom-format, gut für Restore):

   - `PGPASSWORD='<prod_pw>' pg_dump -h 127.0.0.1 -p 55432 -U <prod_user> -d <prod_db> -Fc -f prod.dump`

3. **Lokale Dev-DB leeren** (empfohlen: Volume reset) und Stack starten:

   - `docker compose --env-file infra/.env -f infra/docker-compose.dev.yml down -v`
   - `docker compose --env-file infra/.env -f infra/docker-compose.dev.yml up -d db`

4. **Restore in lokale DB** (im Postgres-Container):

   - Dump in den DB-Container kopieren:
     - `docker cp prod.dump hospitalinsights-db:/tmp/prod.dump`
   - Restore ausführen:
     - `docker exec -e PGPASSWORD=hospitalinsights_pw -i hospitalinsights-db pg_restore -U hospitalinsights -d hospitalinsights --clean --if-exists /tmp/prod.dump`

5. **App/Metabase wieder starten**:

   - `docker compose --env-file infra/.env -f infra/docker-compose.dev.yml up -d`

## Variante B: Dump direkt im Dokploy/Docker-Host erzeugen

Wenn ihr Shell-Zugriff auf den VPS habt, könnt ihr den Dump auch direkt im laufenden Postgres-Container machen.

1. Auf dem VPS den Postgres-Container identifizieren:

   - `docker ps --format "table {{.Names}}\t{{.Image}}"`

2. Dump im Container erzeugen:

   - `docker exec -e PGPASSWORD='<prod_pw>' <postgres-container-name> pg_dump -U <prod_user> -d <prod_db> -Fc -f /tmp/prod.dump`

3. Dump vom VPS kopieren:

   - `docker cp <postgres-container-name>:/tmp/prod.dump ./prod.dump`
   - (danach wie oben lokal restore)

## Was ihr in Production unbedingt beachten solltet

- **Nie** `prisma migrate dev` in Production.
- Production-App sollte beim Start **`prisma migrate deploy`** ausführen (ist bei euch im App-Container-Entrypoint bereits vorgesehen).
- Postgres-Port in Production **nicht** öffentlich exposen. Wenn Zugriff nötig ist: SSH-Tunnel oder VPN.

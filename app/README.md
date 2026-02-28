# HospitalInsights (App)

Dieses Verzeichnis enthält die Next.js App (Portal).

## Lokales Development

Der Dev-Workflow ist Compose-first (App + Postgres + Metabase).
Die einzige Env-Datei ist `infra/.env` (im Repo-Root referenziert).

Anleitung:

- [README.md](../README.md)

Kurzfassung (aus dem Repo-Root ausführen):

```bash
docker compose --env-file infra/.env -f infra/docker-compose.dev.yml up -d --build
docker compose --env-file infra/.env -f infra/docker-compose.dev.yml exec -T app npx prisma migrate deploy
docker compose --env-file infra/.env -f infra/docker-compose.dev.yml exec -T app npx prisma db seed
```

App: http://localhost:3000

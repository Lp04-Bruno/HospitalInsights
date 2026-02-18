# HospitalInsights (App)

Dieses Verzeichnis enthält die Next.js App (Portal).

## Lokales Development

Für den vollständigen Dev-Stack (Postgres + Metabase + App) nutze bitte die Anleitung im Root-README:

- [README.md](../README.md)

Kurzfassung (aus dem Repo-Root ausführen):

```bash
docker compose --env-file infra/.env -f infra/docker-compose.dev.yml up -d --build
```

Die App läuft dann auf http://localhost:3000.

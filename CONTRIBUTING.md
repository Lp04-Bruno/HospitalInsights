# Contributing

Danke für dein Interesse an Hospitalinsights.

Dieses Repository ist öffentlich einsehbar, steht aber unter einer
source-available Lizenz. Bitte lies zuerst [LICENSE](LICENSE). Beiträge sind
willkommen, eine Nutzung außerhalb der dort erlaubten Zwecke braucht jedoch
vorherige schriftliche Zustimmung.

## Entwicklungsfluss

- Erstelle Änderungen auf einem eigenen Branch.
- Pull Requests gehen gegen `develop`, außer es handelt sich um einen Hotfix für
  `master`.
- Halte Änderungen möglichst klein und prüfbar.
- Aktualisiere bei sichtbaren oder relevanten Änderungen immer
  [CHANGELOG.md](CHANGELOG.md). Größere Open-Source-/Architekturarbeiten gehören
  aktuell in `1.2.0`.
- Committe keine Secrets, Dumps, lokalen `.env`-Dateien oder produktiven
  Kundendaten.

## Lokales Setup

```bash
cp infra/.env.example infra/.env
docker compose --env-file infra/.env -f infra/docker-compose.dev.yml up -d --build
docker compose --env-file infra/.env -f infra/docker-compose.dev.yml exec -T app npx prisma migrate deploy
docker compose --env-file infra/.env -f infra/docker-compose.dev.yml exec -T app npx prisma db seed
```

## Qualitätschecks

Führe vor einem Pull Request möglichst diese Checks aus:

```bash
cd app
npm run lint
npm run typecheck
npm test
npm exec -- prettier --ignore-path ../.prettierignore --check ..
npm run build
```

## Code-Konventionen

- Nutze bestehende Patterns, bevor du neue Abstraktionen einführst.
- Halte Server Actions, Domainlogik und UI-Komponenten getrennt.
- Validierung soll bevorzugt über zentrale Zod-Schemas laufen.
- Prisma Generated Files werden nicht manuell editiert.
- Produktionsrelevante Änderungen müssen im Changelog und, falls nötig, in der
  README dokumentiert werden.

## Pull Requests

Ein guter Pull Request enthält:

- eine kurze Beschreibung des Problems und der Lösung;
- Hinweise zu Migrationen, Env-Änderungen oder Breaking Changes;
- relevante Screenshots bei UI-Änderungen;
- eine Liste der lokal ausgeführten Checks.

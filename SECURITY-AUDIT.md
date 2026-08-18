# Security Audit Notes

Letzte Prüfung: 2026-08-18 (Stand Release 1.2.2)

Dieses Dokument hält bewusst akzeptierte oder transitive Findings fest, damit öffentliche Leserinnen und Leser nachvollziehen können, warum ein Advisory nicht blind per `npm audit fix --force` behandelt wurde.

## Aktuelle npm-Audit-Findings

Stand `npm --prefix web audit --audit-level=moderate` (4 Findings, alle high):

| Advisory                                 | Paket             | Pfad                                       | Status                  | Bewertung                                                                                                                                                                                                         |
| ---------------------------------------- | ----------------- | ------------------------------------------ | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GHSA-mh99-v99m-4gvg, GHSA-rgw5-rvv9-x895 | `brace-expansion` | transitiv über `eslint` → `minimatch`      | akzeptiert / beobachten | Reines Lint-Tooling, läuft nur lokal und in CI über repo-eigene Glob-Muster. Kein Laufzeitpfad der Anwendung. Ein Fix ist innerhalb der Semver-Range verfügbar und kommt über Renovate.                           |
| GHSA-ggr8-5vv4-36mx                      | `deepmerge-ts`    | transitiv über `prisma` → `@prisma/config` | akzeptiert / beobachten | Wird beim Einlesen von `prisma.config.ts` verwendet, also repo-eigene Konfiguration ohne externe Eingaben. `npm audit fix --force` würde auf `prisma@6.12.0` downgraden und damit einen Breaking Change auslösen. |

## Entscheidung

Die Findings liegen ausschließlich in Entwicklungs- und CLI-Tooling
(`eslint`, `@prisma/config`) und nicht im Laufzeitpfad der ausgelieferten Anwendung.
Das `deepmerge-ts`-Finding ist nur über einen Prisma-Downgrade auf 6.x auflösbar und
wird deshalb bewusst offen gehalten, bis Prisma eine gepatchte Version nachzieht.
Lockfile-Updates für `brace-expansion` werden über Renovate eingespielt und nicht mit
Release-Commits vermischt.

## Erledigte Findings

Mit Release 1.2.2 sind folgende zuvor dokumentierte Findings entfallen:

- GHSA-w5hq-g745-h8pq (`uuid` über `next-auth`) durch das Update auf `next-auth@^4.24.15`.
- GHSA-qx2v-qp2m-jg93 (`postcss` über `next`) durch das Update auf `next@^16.3.1`.
- GHSA-92pp-h63x-v22m, GHSA-frvp-7c67-39w9 (`@hono/node-server`) sowie vier `hono`-Advisories: `@prisma/dev` hängt seit Prisma 7.9.0 nicht mehr von `hono` ab.
- GHSA-v2hh-gcrm-f6hx, GHSA-7p8r-x3mc-p8w7 (`fast-uri` über `ajv`) und GHSA-5qjj-4xww-7phc (`valibot`) durch die transitiven Bumps in Prisma 7.9.1.

# Security Audit Notes

Letzte Prüfung: 2026-09-06 (Stand Release 1.2.3)

Dieses Dokument hält bewusst akzeptierte oder transitive Findings fest, damit öffentliche Leserinnen und Leser nachvollziehen können, warum ein Advisory nicht blind per `npm audit fix --force` behandelt wurde.

## Aktuelle npm-Audit-Findings

Stand `npm --prefix web audit --audit-level=moderate` (vier high Findings; ausschließlich transitive Prisma-CLI-Pfade):

| Advisory                                 | Paket          | Pfad                                       | Status                  | Bewertung                                                                                                                                                                                                                                                               |
| ---------------------------------------- | -------------- | ------------------------------------------ | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GHSA-ggr8-5vv4-36mx                      | `deepmerge-ts` | transitiv über `prisma` → `@prisma/config` | akzeptiert / beobachten | Wird beim Einlesen von `prisma.config.ts` verwendet, also repo-eigene Konfiguration ohne externe Eingaben. `npm audit fix --force` würde auf `prisma@6.19.3` downgraden und damit einen Breaking Change auslösen.                                                       |
| GHSA-3f6p-5ww8-9rcr, GHSA-rgwj-5xj2-c3m3 | `mysql2`       | transitiv über `prisma`                    | akzeptiert / beobachten | Das Projekt nutzt PostgreSQL über `@prisma/adapter-pg`; `mysql2` ist hier kein Anwendungslaufzeitpfad. Die Abhängigkeit kommt über Prisma-CLI-Tooling. `npm audit fix --force` würde ebenfalls auf `prisma@6.19.3` downgraden und damit einen Breaking Change auslösen. |

## Entscheidung

Die Findings liegen ausschließlich in Prisma-CLI-Tooling und nicht im Laufzeitpfad
der ausgelieferten Anwendung. HospitalInsights nutzt PostgreSQL, nicht MySQL.
Die Findings sind per `npm audit fix --force` nur über einen Prisma-Downgrade auf
6.x auflösbar und werden offen gehalten, bis Prisma eine
gepatchte 7.x-Version nachzieht.

## Erledigte Findings

Mit Release 1.2.2 sind folgende zuvor dokumentierte Findings entfallen:

- GHSA-w5hq-g745-h8pq (`uuid` über `next-auth`) durch das Update auf `next-auth@^4.24.15`.
- GHSA-qx2v-qp2m-jg93 (`postcss` über `next`) durch das Update auf `next@^16.3.1`.
- GHSA-92pp-h63x-v22m, GHSA-frvp-7c67-39w9 (`@hono/node-server`) sowie vier `hono`-Advisories: `@prisma/dev` hängt seit Prisma 7.9.0 nicht mehr von `hono` ab.
- GHSA-v2hh-gcrm-f6hx, GHSA-7p8r-x3mc-p8w7 (`fast-uri` über `ajv`) und GHSA-5qjj-4xww-7phc (`valibot`) durch die transitiven Bumps in Prisma 7.9.1.

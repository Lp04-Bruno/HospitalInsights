# Security Audit Notes

Letzte Prüfung: 2026-06-01

Dieses Dokument hält bewusst akzeptierte oder transitive Findings fest, damit öffentliche Leserinnen und Leser nachvollziehen können, warum ein Advisory nicht blind per `npm audit fix --force` behandelt wurde.

## Aktuelle npm-Audit-Findings

Stand `npm --prefix web audit --audit-level=moderate`:

| Advisory            | Paket                        | Pfad                                          | Status                  | Bewertung                                                                                                                                                           |
| ------------------- | ---------------------------- | --------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GHSA-w5hq-g745-h8pq | `uuid <11.1.1`               | transitiv über `next-auth@4.24.14`            | akzeptiert / beobachten | Hospitalinsights nutzt `uuid` nicht direkt. `npm audit fix --force` würde `next-auth@3.29.10` installieren und damit einen Breaking-Downgrade auslösen.             |
| GHSA-qx2v-qp2m-jg93 | `postcss <8.5.10`            | transitiv über `next@16.2.6`                  | akzeptiert / beobachten | Die App verarbeitet keine benutzerkontrollierten CSS-Strings serverseitig. Ein Force-Fix würde laut npm Audit auf eine alte Next-Version wechseln.                  |
| GHSA-92pp-h63x-v22m | `@hono/node-server <1.19.13` | transitiv über `prisma@7.8.0` / `@prisma/dev` | akzeptiert / beobachten | Der betroffene `serveStatic`-Pfad wird von Hospitalinsights nicht als öffentlicher Server genutzt. Ein Force-Fix würde Prisma auf eine inkompatible Version ändern. |

## Entscheidung

Die Findings werden aktuell nicht per `npm audit fix --force` behoben, weil die
vorgeschlagenen Fixes Breaking-Downgrades auslösen würden. Stattdessen werden
Next.js, NextAuth/Auth.js und Prisma weiter beobachtet und bei verfügbaren
kompatiblen Fix-Releases aktualisiert.

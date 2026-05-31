# Security Policy

## Unterstützte Versionen

Sicherheitsfixes werden für die aktuell auf `master` veröffentlichte Version
und aktive Release-Vorbereitungsbranches geprüft. Ältere Versionen erhalten nur
Best-Effort-Unterstützung.

## Sicherheitslücken melden

Bitte melde Sicherheitsprobleme nicht öffentlich als Issue.

Bevorzugt:

- nutze GitHub Security Advisories / Private Vulnerability Reporting, falls für
  das Repository verfügbar;
- kontaktiere den Maintainer über GitHub (`@Lp04-Bruno`).

Falls kein privater Kanal verfügbar ist, erstelle ein öffentliches Issue mit
neutralem Titel wie `Security contact requested`, aber ohne technische Details.

## Was in einen Report gehört

- betroffene Version oder Commit;
- betroffene Komponente;
- nachvollziehbare Schritte zur Reproduktion;
- erwarteter und tatsächlicher Effekt;
- mögliche Auswirkungen auf Daten, Authentifizierung oder Betrieb;
- falls bekannt: Vorschlag zur Behebung.

## Scope

Relevant sind insbesondere:

- Authentifizierung und Rollenprüfung;
- Zugriff auf Dashboard-, Backup- und Admin-Funktionen;
- Metabase Signed Embedding und Embed-Token;
- Datenbank-Backups, Restore und Upload;
- Umgang mit Secrets und produktiven Daten.

Nicht im Scope sind Social Engineering, physische Angriffe, Spam, rein
theoretische Probleme ohne Auswirkung und Scans gegen fremde Infrastruktur.

## Disclosure

Bitte gib uns angemessene Zeit zur Analyse und Behebung, bevor Details
veröffentlicht werden. Wir bemühen uns um eine zeitnahe Rückmeldung, können aber
keine feste SLA garantieren.

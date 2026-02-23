import { redirect } from "next/navigation";
import { StatementType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getServerAuthSession } from "@/lib/auth";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

function statementLabel(st: StatementType) {
  switch (st) {
    case StatementType.BALANCE_ASSET:
      return "Bilanz – Aktiva";
    case StatementType.BALANCE_LIAB:
      return "Bilanz – Passiva";
    case StatementType.INCOME_STATEMENT_UKV:
      return "GuV (UKV)";
    case StatementType.INCOME_STATEMENT_GKV:
      return "GuV (GKV)";
    case StatementType.CASHFLOW:
      return "Cashflow";
    default:
      return st;
  }
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export default async function DashboardPage() {
  const session = await getServerAuthSession();
  if (!session) redirect("/signin?callbackUrl=/dashboard");

  const isAdmin = session.user.role === "ADMIN";

  const [hospitalCount, periodLatest, periodCount, inputItems, latestSaveRun] = await Promise.all([
    prisma.hospital.count(),
    prisma.period.findFirst({ orderBy: { year: "desc" }, select: { id: true, year: true } }),
    prisma.period.count(),
    prisma.lineItem.findMany({
      where: { isInput: true },
      select: { code: true, statementType: true },
    }),
    prisma.factChangeRun.findFirst({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { email: true, name: true } } },
    }),
  ]);

  const codesByStatement = new Map<StatementType, string[]>();
  for (const li of inputItems) {
    const list = codesByStatement.get(li.statementType) ?? [];
    list.push(li.code);
    codesByStatement.set(li.statementType, list);
  }

  const statementTypes = Object.values(StatementType);

  const completion = await (async () => {
    if (!periodLatest || hospitalCount === 0) {
      return statementTypes.map((st) => ({
        statementType: st,
        expected: 0,
        actual: 0,
        percent: 0,
      }));
    }

    const rows = [] as Array<{
      statementType: StatementType;
      expected: number;
      actual: number;
      percent: number;
    }>;
    for (const st of statementTypes) {
      const codes = codesByStatement.get(st) ?? [];
      const expected = hospitalCount * codes.length;
      const actual =
        expected === 0
          ? 0
          : await prisma.factValue.count({
              where: {
                periodId: periodLatest.id,
                value: { not: null },
                lineItemCode: { in: codes.length > 0 ? codes : ["__none__"] },
              },
            });
      const percent = expected === 0 ? 0 : clampPercent((actual / expected) * 100);
      rows.push({ statementType: st, expected, actual, percent });
    }
    return rows;
  })();

  const expectedTotal = completion.reduce((s, r) => s + r.expected, 0);
  const actualTotal = completion.reduce((s, r) => s + r.actual, 0);
  const missingTotal = Math.max(0, expectedTotal - actualTotal);

  const adminStats = isAdmin ? await Promise.all([prisma.user.count(), prisma.factChangeRun.count(), prisma.factChange.count()]) : null;

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Übersicht</h1>
        <div className={styles.subtitle}>
          {periodLatest ? (
            <span>
              Aktuelles Jahr: <strong>{periodLatest.year}</strong>
            </span>
          ) : (
            <span>Kein Jahr angelegt</span>
          )}
        </div>
      </div>

      <div className={styles.kpis}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Hospitals</div>
          <div className={styles.kpiValue}>{hospitalCount}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Jahre</div>
          <div className={styles.kpiValue}>{periodCount}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Eingaben offen (aktuelles Jahr)</div>
          <div className={styles.kpiValue}>{missingTotal}</div>
          <div className={styles.kpiHint}>{expectedTotal > 0 ? `${actualTotal}/${expectedTotal} ausgefüllt` : "—"}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Letztes Speichern</div>
          <div className={styles.kpiValueSmall}>{latestSaveRun ? latestSaveRun.createdAt.toLocaleString("de-DE") : "—"}</div>
          <div className={styles.kpiHint}>{latestSaveRun ? (latestSaveRun.user?.email ?? latestSaveRun.user?.name ?? "—") : ""}</div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Datenvollständigkeit (aktuelles Jahr)</div>
        <div className={styles.progressList}>
          {completion.map((row) => {
            const missing = Math.max(0, row.expected - row.actual);
            return (
              <div key={row.statementType} className={styles.progressRow}>
                <div className={styles.progressTop}>
                  <div className={styles.progressLabel}>{statementLabel(row.statementType)}</div>
                  <div className={styles.progressMeta}>{row.expected > 0 ? `${row.actual}/${row.expected} · ${missing} offen` : "—"}</div>
                </div>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${row.percent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {isAdmin && adminStats ? (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Admin</div>
          <div className={styles.kpis}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Benutzer</div>
              <div className={styles.kpiValue}>{adminStats[0]}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Audit Runs</div>
              <div className={styles.kpiValue}>{adminStats[1]}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Audit Änderungen</div>
              <div className={styles.kpiValue}>{adminStats[2]}</div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

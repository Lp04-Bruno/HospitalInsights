import { StatementType, Unit } from "@/prisma/generated/enums";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/access";
import { statementLabel } from "@/lib/statements";
import { firstSearchParam, resolveSearchParams, yearSchema } from "@/lib/validation";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
};

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const session = await requireSession("/dashboard");

  const isAdmin = session.user.role === "ADMIN";

  const sp = await resolveSearchParams(searchParams);
  const selectedHospitalId = firstSearchParam(sp.hospitalId);
  const requestedYearResult = yearSchema.safeParse(firstSearchParam(sp.year));
  const requestedYear = requestedYearResult.success ? requestedYearResult.data : undefined;

  const [hospitalCount, singleHospital, selectedHospital, allLineItems, latestSaveRunGlobal, globalPeriodCount, usedPeriodIds] =
    await Promise.all([
      prisma.hospital.count(),
      prisma.hospital.findFirst({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
      selectedHospitalId
        ? prisma.hospital.findUnique({ where: { id: selectedHospitalId }, select: { id: true, name: true } })
        : Promise.resolve(null),
      prisma.lineItem.findMany({
        select: { code: true, statementType: true, label: true, parentCode: true, unit: true, isInput: true },
      }),
      prisma.factChangeRun.findFirst({
        orderBy: { createdAt: "desc" },
        include: { user: { select: { email: true, name: true } } },
      }),
      prisma.period.count(),
      prisma.hospitalPeriod.findMany({ distinct: ["periodId"], select: { periodId: true } }),
    ]);

  const usedYearCount = usedPeriodIds.length;

  const effectiveHospital = selectedHospital ?? (hospitalCount === 1 ? singleHospital : null);

  const hospitalPeriods = effectiveHospital
    ? await prisma.hospitalPeriod.findMany({
        where: { hospitalId: effectiveHospital.id },
        include: { period: { select: { id: true, year: true } } },
        orderBy: { period: { year: "desc" } },
      })
    : [];

  const hospitalYearCount = effectiveHospital ? hospitalPeriods.length : null;

  const periodsForHospital = hospitalPeriods.map((hp) => hp.period);
  const availableYearsForHospital = new Set(periodsForHospital.map((p) => p.year));

  const selectedYear =
    requestedYear !== undefined && (!effectiveHospital || availableYearsForHospital.has(requestedYear))
      ? requestedYear
      : effectiveHospital
        ? periodsForHospital[0]?.year
        : undefined;

  const periodActive = await (async () => {
    if (effectiveHospital) {
      if (selectedYear === undefined) return null;
      return periodsForHospital.find((p) => p.year === selectedYear) ?? null;
    }
    if (selectedYear !== undefined) {
      return prisma.period.findFirst({ where: { year: selectedYear }, select: { id: true, year: true } });
    }
    return prisma.period.findFirst({ orderBy: { year: "desc" }, select: { id: true, year: true } });
  })();

  const latestSaveRunContext = await (async () => {
    if (!periodActive) return null;
    return prisma.factChangeRun.findFirst({
      where: {
        periodId: periodActive.id,
        ...(effectiveHospital ? { hospitalId: effectiveHospital.id } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { email: true, name: true } } },
    });
  })();

  const childrenByCode = new Map<string, string[]>();
  for (const li of allLineItems) {
    if (!li.parentCode) continue;
    const arr = childrenByCode.get(li.parentCode) ?? [];
    arr.push(li.code);
    childrenByCode.set(li.parentCode, arr);
  }

  const byCode = new Map(allLineItems.map((li) => [li.code, li] as const));

  const optionalBreakdownChildCodes = new Set<string>();
  for (const li of allLineItems) {
    if (!li.isInput) continue;
    const children = childrenByCode.get(li.code) ?? [];
    for (const childCode of children) {
      const child = byCode.get(childCode);
      if (!child) continue;
      if (child.unit !== Unit.EUR) continue;
      const label = (child.label ?? "").trim();
      if (!/^davon\b/i.test(label)) continue;
      optionalBreakdownChildCodes.add(childCode);
    }
  }

  const codesByStatement = new Map<StatementType, string[]>();
  for (const li of allLineItems) {
    if (!li.isInput) continue;
    if (optionalBreakdownChildCodes.has(li.code)) continue;
    const list = codesByStatement.get(li.statementType) ?? [];
    list.push(li.code);
    codesByStatement.set(li.statementType, list);
  }

  const statementTypes = Object.values(StatementType);

  const completion = await (async () => {
    const effectiveHospitals = effectiveHospital ? 1 : hospitalCount;
    if (!periodActive || effectiveHospitals === 0) {
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
      const expected = effectiveHospitals * codes.length;
      const actual =
        expected === 0
          ? 0
          : await prisma.factValue.count({
              where: {
                periodId: periodActive.id,
                value: { not: null },
                ...(effectiveHospital ? { hospitalId: effectiveHospital.id } : {}),
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
          {periodActive ? (
            <span>
              Jahr: <strong>{periodActive.year}</strong>
              {effectiveHospital?.name ? (
                <>
                  {" "}
                  · Krankenhaus: <strong>{effectiveHospital.name}</strong>
                </>
              ) : hospitalCount > 1 ? (
                <>
                  {" "}
                  · Krankenhäuser: <strong>{hospitalCount}</strong>
                </>
              ) : null}
            </span>
          ) : (
            <span>Kein Jahr angelegt</span>
          )}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Aktueller Kontext</div>
        <div className={styles.kpis}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>Krankenhaus</div>
            <div className={styles.kpiValueSmall}>
              {effectiveHospital?.name ?? (hospitalCount > 1 ? "Alle" : hospitalCount === 1 ? (singleHospital?.name ?? "—") : "—")}
            </div>
            <div className={styles.kpiHint}>
              {effectiveHospital && hospitalYearCount !== null ? `${hospitalYearCount} Jahre vorhanden` : "—"}
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>Jahr</div>
            <div className={styles.kpiValue}>{periodActive?.year ?? "—"}</div>
            <div className={styles.kpiHint}>{periodActive ? "Ausgewähltes Jahr für Auswertungen" : "Kein Jahr verfügbar"}</div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>Eingaben offen</div>
            <div className={styles.kpiValue}>{missingTotal}</div>
            <div className={styles.kpiHint}>{expectedTotal > 0 ? `${actualTotal}/${expectedTotal} ausgefüllt` : "—"}</div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>Letztes Speichern (Kontext)</div>
            <div className={styles.kpiValueSmall}>
              {latestSaveRunContext ? latestSaveRunContext.createdAt.toLocaleString("de-DE") : "—"}
            </div>
            <div className={styles.kpiHint}>
              {latestSaveRunContext ? (latestSaveRunContext.user?.email ?? latestSaveRunContext.user?.name ?? "—") : ""}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Datenvollständigkeit</div>
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

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Gesamt</div>
        <div className={styles.kpis}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>Krankenhäuser</div>
            <div className={styles.kpiValue}>{hospitalCount}</div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>Jahre (gesamt)</div>
            <div className={styles.kpiValue}>{globalPeriodCount}</div>
            <div className={styles.kpiHint}>Alle angelegten Jahre</div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>Jahre (in Benutzung)</div>
            <div className={styles.kpiValue}>{usedYearCount}</div>
            <div className={styles.kpiHint}>Jahre mit Zuordnung zu Krankenhäusern</div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>Letztes Speichern (gesamt)</div>
            <div className={styles.kpiValueSmall}>{latestSaveRunGlobal ? latestSaveRunGlobal.createdAt.toLocaleString("de-DE") : "—"}</div>
            <div className={styles.kpiHint}>
              {latestSaveRunGlobal ? (latestSaveRunGlobal.user?.email ?? latestSaveRunGlobal.user?.name ?? "—") : ""}
            </div>
          </div>
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

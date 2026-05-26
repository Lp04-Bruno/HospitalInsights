import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { EDITOR_ROLES, requireAdmin, requireAnyRole } from "@/lib/access";
import { statementLabel } from "@/lib/statements";
import {
  firstSearchParam,
  formString,
  parseBooleanString,
  parseStatementType,
  positiveIntSchema,
  resolveSearchParams,
  yearSchema,
} from "@/lib/validation";
import { StatementType, Unit } from "@/prisma/generated/enums";
import type { FactChangeGetPayload } from "@/prisma/generated/models";

import styles from "./page.module.css";
import AuditFilters from "./AuditFilters";
import { ConfirmSubmitButton } from "@/app/dashboard/_components/ConfirmSubmitButton";
import { DashboardHeader, DashboardPage, dashboardUi } from "@/app/dashboard/_components/DashboardUi";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
};

function lastParam(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[v.length - 1];
  return undefined;
}

function boolParam(v: string | string[] | undefined, opts?: { defaultTrue?: boolean }): boolean {
  return parseBooleanString(lastParam(v), opts?.defaultTrue ?? false);
}

function parseISODate(raw: string | undefined): Date | undefined {
  if (!raw) return undefined;
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(raw);
  if (!m) return undefined;
  const d = new Date(`${raw}T00:00:00.000Z`);
  return Number.isFinite(d.getTime()) ? d : undefined;
}

function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function endOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

function isRealChange(beforeValue: unknown, afterValue: unknown): boolean {
  if (beforeValue === null || beforeValue === undefined) {
    return !(afterValue === null || afterValue === undefined);
  }
  if (afterValue === null || afterValue === undefined) return true;
  return String(beforeValue) !== String(afterValue);
}

function unitSuffix(unit: Unit) {
  switch (unit) {
    case Unit.EUR:
      return "EUR";
    case Unit.PERCENT:
      return "%";
    case Unit.COUNT:
      return "Anzahl";
    default:
      return "";
  }
}

function formatNumberDE(value: number, unit: Unit): string {
  const maximumFractionDigits = unit === Unit.PERCENT ? 2 : 0;
  return new Intl.NumberFormat("de-DE", {
    useGrouping: false,
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}

function formatMaybeDecimal(value: unknown, unit: Unit): string {
  if (value === null || value === undefined) return "—";
  const n = Number(String(value));
  if (!Number.isFinite(n)) return String(value);
  return `${formatNumberDE(n, unit)} ${unitSuffix(unit)}`.trim();
}

const changeInclude = {
  run: {
    select: {
      createdAt: true,
      user: { select: { email: true, name: true } },
      hospital: { select: { name: true } },
      period: { select: { year: true } },
    },
  },
} as const;

type ChangeWithRun = FactChangeGetPayload<{ include: typeof changeInclude }>;

export const dynamic = "force-dynamic";

export default async function AuditLogPage({ searchParams }: PageProps) {
  const session = await requireAnyRole(EDITOR_ROLES, "/dashboard/audit");

  async function deleteChange(formData: FormData) {
    "use server";
    await requireAdmin("/dashboard/audit");

    const changeId = formString(formData, "changeId");
    const returnTo = formString(formData, "returnTo") || "/dashboard/audit";
    if (!changeId) redirect(returnTo);

    await prisma.$transaction(async (tx) => {
      const existing = await tx.factChange.findUnique({
        where: { id: changeId },
        select: { runId: true },
      });
      if (!existing) return;

      await tx.factChange.delete({ where: { id: changeId } });

      const remaining = await tx.factChange.count({ where: { runId: existing.runId } });
      if (remaining === 0) {
        await tx.factChangeRun.delete({ where: { id: existing.runId } });
      }
    });

    redirect(returnTo);
  }

  const sp = await resolveSearchParams(searchParams);

  const hospitals = await prisma.hospital.findMany({ orderBy: { name: "asc" } });
  const users = await prisma.user.findMany({
    orderBy: { email: "asc" },
    select: { id: true, email: true, name: true },
  });

  const selectedHospitalId = firstSearchParam(sp.hospitalId) || "";
  const requestedYearResult = yearSchema.safeParse(firstSearchParam(sp.year));
  const requestedYear = requestedYearResult.success ? requestedYearResult.data : undefined;
  const selectedStatementType = parseStatementType(firstSearchParam(sp.statementType));

  const years = await (async () => {
    if (selectedHospitalId) {
      const hospitalPeriods = await prisma.hospitalPeriod.findMany({
        where: { hospitalId: selectedHospitalId },
        include: { period: { select: { year: true } } },
        orderBy: { period: { year: "desc" } },
      });
      return hospitalPeriods.map((hp) => hp.period.year);
    }

    const periodsInUse = await prisma.period.findMany({
      where: { hospitals: { some: {} } },
      orderBy: { year: "desc" },
      select: { year: true },
    });
    return periodsInUse.map((p) => p.year);
  })();

  const availableYears = new Set(years);
  const selectedYear = requestedYear !== undefined && availableYears.has(requestedYear) ? requestedYear : undefined;

  const selectedUserId = firstSearchParam(sp.userId) || "";

  const fromRaw = firstSearchParam(sp.from);
  const toRaw = firstSearchParam(sp.to);
  const fromDate = parseISODate(fromRaw);
  const toDate = parseISODate(toRaw);

  const realOnly = boolParam(sp.realOnly, { defaultTrue: true });
  const mine = boolParam(sp.mine);

  const q = (firstSearchParam(sp.q) ?? "").trim();

  const effectiveUserId = mine ? session.user.id : selectedUserId;

  const pageResult = positiveIntSchema.safeParse(firstSearchParam(sp.page));
  const page = pageResult.success ? Math.max(1, Math.trunc(pageResult.data)) : 1;
  const take = 200;
  const skip = (page - 1) * take;

  const selectedPeriodId =
    selectedYear !== undefined ? (await prisma.period.findUnique({ where: { year: selectedYear }, select: { id: true } }))?.id : undefined;

  const matchedCodes =
    q.length > 0
      ? (
          await prisma.lineItem.findMany({
            where: {
              ...(selectedStatementType ? { statementType: selectedStatementType } : {}),
              OR: [{ code: { contains: q, mode: "insensitive" } }, { label: { contains: q, mode: "insensitive" } }],
            },
            select: { code: true },
            take: 500,
          })
        ).map((x) => x.code)
      : [];

  const and: Array<Record<string, unknown>> = [];
  if (selectedHospitalId) and.push({ hospitalId: selectedHospitalId });
  if (selectedPeriodId) and.push({ periodId: selectedPeriodId });
  if (selectedStatementType) and.push({ statementType: selectedStatementType });

  const runWhere: Record<string, unknown> = {};
  if (effectiveUserId) runWhere.userId = effectiveUserId;
  if (fromDate || toDate) {
    runWhere.createdAt = {
      ...(fromDate ? { gte: startOfDayUTC(fromDate) } : {}),
      ...(toDate ? { lte: endOfDayUTC(toDate) } : {}),
    };
  }
  if (Object.keys(runWhere).length > 0) and.push({ run: runWhere });

  if (q.length > 0) {
    const ors: Array<Record<string, unknown>> = [{ lineItemCode: { contains: q, mode: "insensitive" } }];
    if (matchedCodes.length > 0) ors.push({ lineItemCode: { in: matchedCodes } });
    and.push({ OR: ors });
  }

  const where = and.length > 0 ? { AND: and } : undefined;

  const orderBy = [{ createdAt: "desc" as const }, { id: "desc" as const }];

  let hasMore = false;
  let changes: ChangeWithRun[] = [];

  if (!realOnly) {
    const rows = await prisma.factChange.findMany({
      where,
      orderBy,
      skip,
      take: take + 1,
      include: changeInclude,
    });
    hasMore = rows.length > take;
    changes = rows.slice(0, take);
  } else {
    const pageItems: typeof changes = [];
    let filteredSkipped = 0;
    let cursorId: string | undefined;
    const chunkSize = 500;
    let safety = 0;

    while (pageItems.length < take + 1 && safety < 30) {
      safety += 1;
      const rows = await prisma.factChange.findMany({
        where,
        orderBy,
        take: chunkSize,
        ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
        include: changeInclude,
      });

      if (rows.length === 0) break;

      for (const row of rows) {
        if (!isRealChange(row.beforeValue, row.afterValue)) continue;
        if (filteredSkipped < skip) {
          filteredSkipped += 1;
          continue;
        }
        pageItems.push(row);
        if (pageItems.length >= take + 1) break;
      }

      cursorId = rows[rows.length - 1].id;
    }

    hasMore = pageItems.length > take;
    changes = pageItems.slice(0, take);
  }

  const codes = Array.from(new Set(changes.map((c) => c.lineItemCode)));
  const items =
    codes.length > 0
      ? await prisma.lineItem.findMany({
          where: { code: { in: codes } },
          select: { code: true, label: true },
        })
      : [];
  const labelByCode = new Map(items.map((i) => [i.code, i.label] as const));

  const qsBase = new URLSearchParams();
  if (selectedHospitalId) qsBase.set("hospitalId", selectedHospitalId);
  if (selectedYear !== undefined) qsBase.set("year", String(selectedYear));
  if (selectedStatementType) qsBase.set("statementType", selectedStatementType);
  if (selectedUserId) qsBase.set("userId", selectedUserId);
  if (fromRaw) qsBase.set("from", fromRaw);
  if (toRaw) qsBase.set("to", toRaw);
  if (q) qsBase.set("q", q);
  if (!realOnly) qsBase.set("realOnly", "0");
  if (mine) qsBase.set("mine", "1");

  const prevHref = (() => {
    if (page <= 1) return null;
    const qs = new URLSearchParams(qsBase);
    qs.set("page", String(page - 1));
    return `/dashboard/audit?${qs.toString()}`;
  })();

  const nextHref = (() => {
    if (!hasMore) return null;
    const qs = new URLSearchParams(qsBase);
    qs.set("page", String(page + 1));
    return `/dashboard/audit?${qs.toString()}`;
  })();

  const returnTo = `/dashboard/audit?${qsBase.toString()}${qsBase.toString() ? "&" : ""}page=${page}`;
  const isAdmin = session.user.role === "ADMIN";

  return (
    <DashboardPage>
      <DashboardHeader title="Audit Log" subtitle={`Letzte Änderungen (Seite ${page})`} />

      <AuditFilters
        key={qsBase.toString()}
        hospitals={hospitals.map((h) => ({ value: h.id, label: h.name }))}
        users={users.map((u) => ({ value: u.id, label: u.email ?? u.name ?? u.id }))}
        years={years}
        statementOptions={Object.values(StatementType).map((st) => ({
          value: st,
          label: statementLabel(st),
        }))}
        initial={{
          hospitalId: selectedHospitalId,
          userId: selectedUserId,
          from: fromRaw ?? "",
          to: toRaw ?? "",
          q,
          year: selectedYear !== undefined ? String(selectedYear) : "",
          statementType: selectedStatementType ?? "",
          realOnly,
          mine,
        }}
      />

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Zeitpunkt</th>
              <th className={styles.th}>Benutzer</th>
              <th className={styles.th}>Hospital</th>
              <th className={styles.th}>Jahr</th>
              <th className={styles.th}>Statement</th>
              <th className={styles.th}>Position</th>
              <th className={styles.th}>Vorher</th>
              <th className={styles.th}>Nachher</th>
              {isAdmin ? <th className={styles.th}>Aktionen</th> : null}
            </tr>
          </thead>
          <tbody>
            {changes.map((c) => {
              const who = c.run.user?.email ?? c.run.user?.name ?? "—";
              const label = labelByCode.get(c.lineItemCode) ?? c.lineItemCode;
              const before = formatMaybeDecimal(c.beforeValue, c.unit);
              const after = formatMaybeDecimal(c.afterValue, c.unit);

              return (
                <tr key={c.id}>
                  <td className={styles.td}>{c.run.createdAt.toLocaleString("de-DE")}</td>
                  <td className={styles.td}>{who}</td>
                  <td className={styles.td}>{c.run.hospital.name}</td>
                  <td className={styles.td}>{c.run.period.year}</td>
                  <td className={styles.td}>{statementLabel(c.statementType)}</td>
                  <td className={styles.td}>
                    <div>{label}</div>
                    <div className={styles.mono}>{c.lineItemCode}</div>
                  </td>
                  <td className={styles.td}>{before}</td>
                  <td className={styles.td}>{after}</td>
                  {isAdmin ? (
                    <td className={styles.td}>
                      <form action={deleteChange}>
                        <input type="hidden" name="changeId" value={c.id} />
                        <input type="hidden" name="returnTo" value={returnTo} />
                        <ConfirmSubmitButton
                          className={`${dashboardUi.button} ${dashboardUi.danger}`}
                          confirmMessage="Diese Audit-Änderung wirklich löschen?"
                        >
                          Löschen
                        </ConfirmSubmitButton>
                      </form>
                    </td>
                  ) : null}
                </tr>
              );
            })}

            {changes.length === 0 ? (
              <tr>
                <td className={styles.td} colSpan={isAdmin ? 9 : 8}>
                  Keine Einträge gefunden.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>
        <div className={styles.muted}>Zeige {changes.length} Einträge</div>
        <div className={styles.pagination}>
          {prevHref ? (
            <Link className={styles.pagerLink} href={prevHref}>
              ← Zurück
            </Link>
          ) : (
            <span className={styles.muted}>← Zurück</span>
          )}
          {nextHref ? (
            <Link className={styles.pagerLink} href={nextHref}>
              Weiter →
            </Link>
          ) : (
            <span className={styles.muted}>Weiter →</span>
          )}
        </div>
      </div>
    </DashboardPage>
  );
}

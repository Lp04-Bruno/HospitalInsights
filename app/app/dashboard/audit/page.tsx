import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getServerAuthSession } from "@/lib/auth";
import { statementLabel } from "@/lib/statements";
import { Prisma, StatementType, Unit } from "@prisma/client";

import styles from "./page.module.css";
import AuditFilters from "./AuditFilters";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
};

function firstParam(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}

function lastParam(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[v.length - 1];
  return undefined;
}

function boolParam(v: string | string[] | undefined, opts?: { defaultTrue?: boolean }): boolean {
  const raw = lastParam(v);
  if (raw === undefined) return opts?.defaultTrue ?? false;
  if (raw === "1" || raw.toLowerCase() === "true") return true;
  if (raw === "0" || raw.toLowerCase() === "false") return false;
  return opts?.defaultTrue ?? false;
}

async function resolveSearchParams(searchParams: PageProps["searchParams"]): Promise<Record<string, string | string[] | undefined>> {
  if (!searchParams) return {};
  const maybePromise = searchParams as unknown as { then?: unknown };
  if (typeof maybePromise.then === "function") {
    return (await (searchParams as Promise<Record<string, string | string[] | undefined>>)) ?? {};
  }
  return (searchParams as Record<string, string | string[] | undefined>) ?? {};
}

function parseStatementType(raw: string | undefined): StatementType | undefined {
  if (!raw) return undefined;
  const values = Object.values(StatementType) as string[];
  return values.includes(raw) ? (raw as StatementType) : undefined;
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

type ChangeWithRun = Prisma.FactChangeGetPayload<{ include: typeof changeInclude }>;

export const dynamic = "force-dynamic";

export default async function AuditLogPage({ searchParams }: PageProps) {
  const session = await getServerAuthSession();
  if (!session) redirect("/signin?callbackUrl=/dashboard/audit");
  if (session.user.role !== "ADMIN" && session.user.role !== "EDITOR") {
    redirect("/dashboard/forbidden");
  }

  async function deleteChange(formData: FormData) {
    "use server";
    const session = await getServerAuthSession();
    if (!session) redirect("/signin?callbackUrl=/dashboard/audit");
    if (session.user.role !== "ADMIN") redirect("/dashboard/forbidden");

    const changeId = String(formData.get("changeId") ?? "").trim();
    const returnTo = String(formData.get("returnTo") ?? "/dashboard/audit").trim() || "/dashboard/audit";
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
  const periods = await prisma.period.findMany({ orderBy: { year: "desc" } });
  const users = await prisma.user.findMany({
    orderBy: { email: "asc" },
    select: { id: true, email: true, name: true },
  });

  const selectedHospitalId = firstParam(sp.hospitalId) || "";
  const yearRaw = firstParam(sp.year);
  const selectedYear = yearRaw && Number.isFinite(Number(yearRaw)) ? Number(yearRaw) : undefined;
  const selectedStatementType = parseStatementType(firstParam(sp.statementType));

  const selectedUserId = firstParam(sp.userId) || "";

  const fromRaw = firstParam(sp.from);
  const toRaw = firstParam(sp.to);
  const fromDate = parseISODate(fromRaw);
  const toDate = parseISODate(toRaw);

  const realOnly = boolParam(sp.realOnly, { defaultTrue: true });
  const mine = boolParam(sp.mine);

  const q = (firstParam(sp.q) ?? "").trim();

  const effectiveUserId = mine ? session.user.id : selectedUserId;

  const pageRaw = firstParam(sp.page);
  const page = pageRaw && Number.isFinite(Number(pageRaw)) ? Math.max(1, Math.trunc(Number(pageRaw))) : 1;
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
    <section className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Audit Log</h1>
        <div className={styles.muted}>Letzte Änderungen (Seite {page})</div>
      </div>

      <AuditFilters
        hospitals={hospitals.map((h) => ({ value: h.id, label: h.name }))}
        users={users.map((u) => ({ value: u.id, label: u.email ?? u.name ?? u.id }))}
        years={periods.map((p) => p.year)}
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
                        <button className={styles.dangerSmall} type="submit">
                          Löschen
                        </button>
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
    </section>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getServerAuthSession } from "@/lib/auth";
import { FactChangeRunKind, StatementType, Unit } from "@prisma/client";

import styles from "./page.module.css";

type PageProps = {
    searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
};

function firstParam(v: string | string[] | undefined): string | undefined {
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return v[0];
    return undefined;
}

async function resolveSearchParams(
    searchParams: PageProps["searchParams"]
): Promise<Record<string, string | string[] | undefined>> {
    if (!searchParams) return {};
    const maybePromise = searchParams as unknown as { then?: unknown };
    if (typeof maybePromise.then === "function") {
        return (
            (await (searchParams as Promise<Record<string, string | string[] | undefined>>)) ?? {}
        );
    }
    return (searchParams as Record<string, string | string[] | undefined>) ?? {};
}

function parseStatementType(raw: string | undefined): StatementType | undefined {
    if (!raw) return undefined;
    const values = Object.values(StatementType) as string[];
    return values.includes(raw) ? (raw as StatementType) : undefined;
}

function parseRunKind(raw: string | undefined): FactChangeRunKind | undefined {
    if (!raw) return undefined;
    const values = Object.values(FactChangeRunKind) as string[];
    return values.includes(raw) ? (raw as FactChangeRunKind) : undefined;
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
    const maximumFractionDigits = unit === Unit.COUNT ? 0 : 2;
    return new Intl.NumberFormat("de-DE", {
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

export const dynamic = "force-dynamic";

export default async function AuditLogPage({ searchParams }: PageProps) {
    const session = await getServerAuthSession();
    if (!session) redirect("/signin?callbackUrl=/dashboard/audit");
    if (session.user.role !== "ADMIN" && session.user.role !== "EDITOR") {
        redirect("/dashboard/forbidden");
    }

    const sp = await resolveSearchParams(searchParams);

    const hospitals = await prisma.hospital.findMany({ orderBy: { name: "asc" } });
    const periods = await prisma.period.findMany({ orderBy: { year: "desc" } });

    const selectedHospitalId = firstParam(sp.hospitalId) || "";
    const yearRaw = firstParam(sp.year);
    const selectedYear = yearRaw && Number.isFinite(Number(yearRaw)) ? Number(yearRaw) : undefined;
    const selectedStatementType = parseStatementType(firstParam(sp.statementType));
    const selectedKind = parseRunKind(firstParam(sp.kind));

    const pageRaw = firstParam(sp.page);
    const page = pageRaw && Number.isFinite(Number(pageRaw)) ? Math.max(1, Math.trunc(Number(pageRaw))) : 1;
    const take = 200;
    const skip = (page - 1) * take;

    const selectedPeriodId =
        selectedYear !== undefined
            ? (await prisma.period.findUnique({ where: { year: selectedYear }, select: { id: true } }))?.id
            : undefined;

    const where = {
        ...(selectedHospitalId ? { hospitalId: selectedHospitalId } : {}),
        ...(selectedPeriodId ? { periodId: selectedPeriodId } : {}),
        ...(selectedStatementType ? { statementType: selectedStatementType } : {}),
        ...(selectedKind ? { run: { kind: selectedKind } } : {}),
    };

    const changes = await prisma.factChange.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
            run: {
                select: {
                    kind: true,
                    createdAt: true,
                    user: { select: { email: true, name: true } },
                    hospital: { select: { name: true } },
                    period: { select: { year: true } },
                },
            },
        },
    });

    const codes = Array.from(new Set(changes.map((c) => c.lineItemCode)));
    const items =
        codes.length > 0
            ? await prisma.lineItem.findMany({ where: { code: { in: codes } }, select: { code: true, label: true } })
            : [];
    const labelByCode = new Map(items.map((i) => [i.code, i.label] as const));

    const qsBase = new URLSearchParams();
    if (selectedHospitalId) qsBase.set("hospitalId", selectedHospitalId);
    if (selectedYear !== undefined) qsBase.set("year", String(selectedYear));
    if (selectedStatementType) qsBase.set("statementType", selectedStatementType);
    if (selectedKind) qsBase.set("kind", selectedKind);

    const prevHref = (() => {
        if (page <= 1) return null;
        const qs = new URLSearchParams(qsBase);
        qs.set("page", String(page - 1));
        return `/dashboard/audit?${qs.toString()}`;
    })();

    const nextHref = (() => {
        if (changes.length < take) return null;
        const qs = new URLSearchParams(qsBase);
        qs.set("page", String(page + 1));
        return `/dashboard/audit?${qs.toString()}`;
    })();

    return (
        <section className={styles.page}>
            <div className={styles.header}>
                <h1 className={styles.title}>Historie / Audit Log</h1>
                <div className={styles.muted}>Letzte Änderungen (Seite {page})</div>
            </div>

            <form className={styles.filters}>
                <div className={styles.field}>
                    <label>Hospital</label>
                    <select name="hospitalId" defaultValue={selectedHospitalId}>
                        <option value="">Alle</option>
                        {hospitals.map((h) => (
                            <option key={h.id} value={h.id}>
                                {h.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className={styles.field}>
                    <label>Jahr</label>
                    <select name="year" defaultValue={selectedYear !== undefined ? String(selectedYear) : ""}>
                        <option value="">Alle</option>
                        {periods.map((p) => (
                            <option key={p.id} value={String(p.year)}>
                                {p.year}
                            </option>
                        ))}
                    </select>
                </div>

                <div className={styles.field}>
                    <label>Statement</label>
                    <select name="statementType" defaultValue={selectedStatementType ?? ""}>
                        <option value="">Alle</option>
                        {Object.values(StatementType).map((st) => (
                            <option key={st} value={st}>
                                {statementLabel(st)}
                            </option>
                        ))}
                    </select>
                </div>

                <div className={styles.field}>
                    <label>Aktion</label>
                    <select name="kind" defaultValue={selectedKind ?? ""}>
                        <option value="">Alle</option>
                        {Object.values(FactChangeRunKind).map((k) => (
                            <option key={k} value={k}>
                                {k}
                            </option>
                        ))}
                    </select>
                </div>

                <div className={styles.actions}>
                    <button className={styles.button} type="submit">
                        Filtern
                    </button>
                    <Link className={styles.secondary} href="/dashboard/audit">
                        Reset
                    </Link>
                </div>
            </form>

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
                            <th className={styles.th}>Run</th>
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
                                    <td className={styles.td}>{c.run.kind}</td>
                                </tr>
                            );
                        })}

                        {changes.length === 0 ? (
                            <tr>
                                <td className={styles.td} colSpan={9}>
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

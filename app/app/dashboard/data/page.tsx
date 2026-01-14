import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getServerAuthSession } from "@/lib/auth";
import { StatementType, Unit } from "@prisma/client";
import styles from "./page.module.css";
import { ValueEntryTable } from "@/app/dashboard/data/ValueEntryTable";

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
        return (await (searchParams as Promise<Record<string, string | string[] | undefined>>)) ?? {};
    }
    return (searchParams as Record<string, string | string[] | undefined>) ?? {};
}

function parseStatementType(raw: string | undefined): StatementType | undefined {
    if (!raw) return undefined;
    const values = Object.values(StatementType) as string[];
    return values.includes(raw) ? (raw as StatementType) : undefined;
}

function parseUserNumber(raw: string, unit: Unit): number | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    // Accept inputs like: 129.658.900,5  | 129658900.5 | 39% | 39,0%
    const normalized = trimmed
        .replace(/\s+/g, "")
        .replace(/%/g, "")
        .replace(/\./g, "")
        .replace(/,/g, ".");

    const num = Number(normalized);
    if (!Number.isFinite(num)) return null;

    if (unit === Unit.COUNT) return Math.trunc(num);
    return num;
}

function formatNumberDE(value: number, unit: Unit): string {
    const maximumFractionDigits = unit === Unit.COUNT ? 0 : 1;
    return new Intl.NumberFormat("de-DE", {
        maximumFractionDigits,
        minimumFractionDigits: unit === Unit.COUNT ? 0 : 0,
    }).format(value);
}

function displayValue(raw: string | undefined, unit: Unit): string {
    if (!raw) return "";
    const n = Number(raw);
    if (!Number.isFinite(n)) return raw;
    return formatNumberDE(n, unit);
}

type FlatRow = {
    code: string;
    depth: number;
    label: string;
    unit: Unit;
    isInput: boolean;
    isSection: boolean;
    hasChildren: boolean;
    prettyValue: string;
};

function nominalLevelFromLabel(label: string): number {
    const t = label.trim();
    if (/\(Summe\)/i.test(t)) return 0;
    if (/^(Bilanz|GuV|Cashflow)\b/i.test(t)) return 0;
    if (/^[A-Z]\./.test(t)) return 0;
    if (/^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)\./.test(t)) return 1;
    if (/^\d+\./.test(t)) return 2;
    if (/^davon\b/i.test(t)) return 3;
    return 2;
}

function isSectionLabel(label: string): boolean {
    const t = label.trim();
    return /\(Summe\)/i.test(t) || /^(Bilanz|GuV|Cashflow)\b/i.test(t) || /^[A-Z]\./.test(t);
}

async function createPeriod(formData: FormData) {
    "use server";
    const yearRaw = String(formData.get("year") ?? "").trim();
    const year = Number(yearRaw);

    const hospitalId = String(formData.get("hospitalId") ?? "").trim();
    const statementType = String(formData.get("statementType") ?? "").trim();
    if (!hospitalId) redirect("/dashboard/data");

    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
        redirect(`/dashboard/data?hospitalId=${encodeURIComponent(hospitalId)}`);
    }

    await prisma.period.upsert({
        where: { year },
        update: {},
        create: { year },
    });

    const qs = new URLSearchParams();
    qs.set("hospitalId", hospitalId);
    qs.set("year", String(year));
    if (parseStatementType(statementType)) qs.set("statementType", statementType);
    redirect(`/dashboard/data?${qs.toString()}`);
}

async function saveFacts(formData: FormData) {
    "use server";

    const hospitalId = String(formData.get("hospitalId") ?? "");
    const periodId = String(formData.get("periodId") ?? "");
    const statementType = String(formData.get("statementType") ?? "") as StatementType;

    if (!hospitalId || !periodId || !statementType) redirect("/dashboard/data");

    const inputItems = await prisma.lineItem.findMany({
        where: { statementType, isInput: true },
        orderBy: { sortOrder: "asc" },
    });

    for (const item of inputItems) {
        const key = `v:${item.code}`;
        const raw = String(formData.get(key) ?? "");
        const parsed = parseUserNumber(raw, item.unit);

        if (parsed === null) {
            await prisma.factValue.deleteMany({
                where: {
                    hospitalId,
                    periodId,
                    lineItemCode: item.code,
                },
            });
            continue;
        }

        await prisma.factValue.upsert({
            where: {
                hospitalId_periodId_lineItemCode: {
                    hospitalId,
                    periodId,
                    lineItemCode: item.code,
                },
            },
            update: { value: parsed },
            create: {
                hospitalId,
                periodId,
                lineItemCode: item.code,
                value: parsed,
            },
        });
    }

    const period = await prisma.period.findUnique({ where: { id: periodId } });
    const year = period?.year;

    const qs = new URLSearchParams();
    qs.set("hospitalId", hospitalId);
    if (year) qs.set("year", String(year));
    qs.set("statementType", statementType);
    qs.set("saved", "1");

    redirect(`/dashboard/data?${qs.toString()}`);
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

export default async function DashboardDataPage({ searchParams }: PageProps) {
    const session = await getServerAuthSession();
    if (!session) redirect("/signin?callbackUrl=/dashboard/data");
    if (session.user.role !== "ADMIN" && session.user.role !== "EDITOR") {
        redirect("/dashboard/forbidden");
    }

    const sp = await resolveSearchParams(searchParams);

    const hospitals = await prisma.hospital.findMany({
        orderBy: { name: "asc" },
    });

    const selectedHospitalId =
        typeof firstParam(sp.hospitalId) === "string" && firstParam(sp.hospitalId)
            ? (firstParam(sp.hospitalId) as string)
            : hospitals[0]?.id;

    const periods = await prisma.period.findMany({ orderBy: { year: "desc" } });

    const selectedYear =
        typeof firstParam(sp.year) === "string" && Number.isFinite(Number(firstParam(sp.year)))
            ? Number(firstParam(sp.year))
            : periods[0]?.year;

    const selectedStatementType: StatementType =
        parseStatementType(firstParam(sp.statementType)) ?? StatementType.BALANCE_ASSET;

    const selectedPeriod = selectedYear
        ? await prisma.period.findUnique({ where: { year: selectedYear } })
        : null;

    const lineItems = await prisma.lineItem.findMany({
        where: { statementType: selectedStatementType },
        orderBy: { sortOrder: "asc" },
    });

    const codes = lineItems.map((li) => li.code);
    const facts =
        selectedHospitalId && selectedPeriod
            ? await prisma.factValue.findMany({
                where: {
                    hospitalId: selectedHospitalId,
                    periodId: selectedPeriod.id,
                    lineItemCode: { in: codes },
                },
            })
            : [];

    const factMap = new Map<string, string>();
    for (const f of facts) {
        if (f.value === null) continue;
        factMap.set(f.lineItemCode, String(f.value));
    }

    const provisional: Array<Omit<FlatRow, "hasChildren">> = [];
    const stackCodes: Array<string | undefined> = [];
    const isIncomeStatement =
        selectedStatementType === StatementType.INCOME_STATEMENT_UKV ||
        selectedStatementType === StatementType.INCOME_STATEMENT_GKV;

    for (const li of lineItems) {
        const nominal = nominalLevelFromLabel(li.label);
        let level = nominal;

        if (isIncomeStatement && nominal === 2) level = 0;

        while (level > 0 && !stackCodes[level - 1]) level -= 1;

        const rawValue = factMap.get(li.code) ?? "";
        provisional.push({
            code: li.code,
            depth: level,
            label: li.label,
            unit: li.unit,
            isInput: li.isInput,
            isSection: isSectionLabel(li.label),
            prettyValue: displayValue(rawValue, li.unit),
        });

        stackCodes.length = level;
        stackCodes[level] = li.code;
    }

    const flatRows: FlatRow[] = provisional.map((r, idx) => {
        const next = provisional[idx + 1];
        const hasChildren = !!next && next.depth > r.depth;
        return { ...r, hasChildren };
    });

    return (
        <section className={styles.page}>
            <header className={styles.header}>
                <h1 className={styles.title}>Datenverwaltung</h1>
                <p className={styles.subtitle}>
                    Werte pro Krankenhaus, Jahr und Bereich erfassen (analog zur Eingabe-Tabelle).
                </p>
            </header>

            {firstParam(sp.saved) === "1" && <div className={styles.notice}>Gespeichert.</div>}

            {hospitals.length === 0 ? (
                <div className={styles.notice}>
                    Es gibt noch keine Krankenhäuser. Lege zuerst eins in der Hospitalverwaltung an.
                    <a className={styles.inlineLink} href="/dashboard/hospitals">
                        Hospitalverwaltung öffnen
                    </a>
                </div>
            ) : null}

            <div className={styles.card}>
                <div className={styles.cardHeader}>
                    <div>
                        <div className={styles.cardTitle}>Auswahl</div>
                        <div className={styles.cardHint}>Wähle Kontext und lade dann die Positionen.</div>
                    </div>
                </div>

                {selectedHospitalId && (
                    <form method="get" className={styles.filters}>
                        <label className={styles.field}>
                            Krankenhaus
                            <select name="hospitalId" className={styles.select} defaultValue={selectedHospitalId}>
                                {hospitals.map((h) => (
                                    <option key={h.id} value={h.id}>
                                        {h.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className={styles.field}>
                            Jahr
                            <select name="year" className={styles.select} defaultValue={selectedYear ?? ""}>
                                {periods.map((p) => (
                                    <option key={p.id} value={p.year}>
                                        {p.year}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <input type="hidden" name="statementType" value={selectedStatementType} />

                        <div className={styles.filterActions}>
                            <button className={styles.button} type="submit">
                                Anzeigen
                            </button>
                        </div>
                    </form>
                )}

                {selectedHospitalId ? (
                    <div className={styles.tabs}>
                        {Object.values(StatementType).map((st) => {
                            const qs = new URLSearchParams();
                            qs.set("hospitalId", selectedHospitalId);
                            if (selectedYear) qs.set("year", String(selectedYear));
                            qs.set("statementType", st);
                            const active = st === selectedStatementType;
                            return (
                                <Link
                                    key={st}
                                    href={`/dashboard/data?${qs.toString()}`}
                                    className={`${styles.tab} ${active ? styles.tabActive : ""}`}
                                >
                                    {statementLabel(st)}
                                </Link>
                            );
                        })}
                    </div>
                ) : null}

                {selectedHospitalId && (
                    <form action={createPeriod} className={styles.createYear}>
                        <input type="hidden" name="hospitalId" value={selectedHospitalId} />
                        <input type="hidden" name="statementType" value={selectedStatementType} />
                        <label className={styles.field}>
                            Jahr anlegen
                            <input name="year" className={styles.input} placeholder="z.B. 2024" />
                        </label>
                        <div className={styles.filterActions}>
                            <button className={styles.secondary} type="submit">
                                Jahr anlegen
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {!selectedPeriod ? (
                <div className={styles.notice}>Bitte wähle ein Jahr aus (oder lege eins an).</div>
            ) : lineItems.length === 0 ? (
                <div className={styles.notice}>
                    Keine Positionen vorhanden für {statementLabel(selectedStatementType)}. (Seed noch nicht gelaufen?)
                </div>
            ) : (
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <div>
                            <div className={styles.cardTitle}>{statementLabel(selectedStatementType)}</div>
                            <div className={styles.cardHint}>
                                {selectedYear} · {hospitals.find((h) => h.id === selectedHospitalId)?.name}
                            </div>
                        </div>
                    </div>

                    <form action={saveFacts}>
                        <input type="hidden" name="hospitalId" value={selectedHospitalId} />
                        <input type="hidden" name="periodId" value={selectedPeriod.id} />
                        <input type="hidden" name="statementType" value={selectedStatementType} />

                        <ValueEntryTable rows={flatRows} />

                        <div className={styles.saveRow}>
                            <button className={styles.button} type="submit">
                                Speichern
                            </button>
                            <div className={styles.saveHint}>
                                Zahlen wie <code>129.658.900,5</code>, <code>129658900.5</code> oder <code>39%</code>.
                            </div>
                        </div>
                    </form>
                </div>
            )}
        </section>
    );
}

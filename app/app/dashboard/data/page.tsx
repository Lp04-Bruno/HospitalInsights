import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { statementLabel } from "@/lib/statements";
import { getStatementCatalog } from "@/lib/statementCatalog";
import { EDITOR_ROLES, requireAnyRole } from "@/lib/access";
import { saveFacts } from "@/lib/facts/saveFacts";
import { buildStatementRows } from "@/lib/facts/statementRows";
import { StatementType, Unit } from "@/prisma/generated/enums";
import styles from "./page.module.css";
import { DirtySaveForm } from "@/app/dashboard/data/DirtySaveForm";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
};

const BALANCE_TAB = "BALANCE" as const;
type StatementTab = typeof BALANCE_TAB | StatementType;

const STATEMENT_TABS: StatementTab[] = [
  BALANCE_TAB,
  StatementType.INCOME_STATEMENT_UKV,
  StatementType.INCOME_STATEMENT_GKV,
  StatementType.CASHFLOW,
];

function firstParam(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
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

function parseStatementTab(raw: string | undefined): StatementTab | undefined {
  if (!raw) return undefined;
  if (raw === BALANCE_TAB) return BALANCE_TAB;

  const parsed = parseStatementType(raw);
  if (!parsed) return undefined;
  if (parsed === StatementType.BALANCE_ASSET || parsed === StatementType.BALANCE_LIAB) return BALANCE_TAB;
  return parsed;
}

function tabLabel(tab: StatementTab): string {
  if (tab === BALANCE_TAB) return "Bilanz";
  return statementLabel(tab);
}

async function requireDataAccess() {
  return requireAnyRole(EDITOR_ROLES, "/dashboard/data");
}

async function createPeriod(formData: FormData) {
  "use server";

  await requireDataAccess();

  const yearRaw = String(formData.get("year") ?? "").trim();
  const year = Number(yearRaw);

  const hospitalId = String(formData.get("hospitalId") ?? "").trim();
  const statementType = String(formData.get("statementType") ?? "").trim();
  if (!hospitalId) redirect("/dashboard/data");

  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    redirect(`/dashboard/data?hospitalId=${encodeURIComponent(hospitalId)}`);
  }

  const period = await prisma.period.upsert({
    where: { year },
    update: {},
    create: { year },
    select: { id: true, year: true },
  });

  await prisma.hospitalPeriod.upsert({
    where: { hospitalId_periodId: { hospitalId, periodId: period.id } },
    update: {},
    create: { hospitalId, periodId: period.id },
  });

  const qs = new URLSearchParams();
  qs.set("hospitalId", hospitalId);
  qs.set("year", String(year));
  if (parseStatementTab(statementType)) qs.set("statementType", statementType);
  redirect(`/dashboard/data?${qs.toString()}`);
}

export default async function DashboardDataPage({ searchParams }: PageProps) {
  await requireDataAccess();

  const sp = await resolveSearchParams(searchParams);

  const hospitals = await prisma.hospital.findMany({
    orderBy: { name: "asc" },
  });

  const selectedHospitalId =
    typeof firstParam(sp.hospitalId) === "string" && firstParam(sp.hospitalId) ? (firstParam(sp.hospitalId) as string) : hospitals[0]?.id;

  const hospitalPeriods = selectedHospitalId
    ? await prisma.hospitalPeriod.findMany({
        where: { hospitalId: selectedHospitalId },
        include: { period: { select: { id: true, year: true } } },
        orderBy: { period: { year: "desc" } },
      })
    : [];

  const periods = hospitalPeriods.map((hp) => hp.period);
  const availableYears = new Set(periods.map((p) => p.year));

  const requestedYearRaw = firstParam(sp.year);
  const requestedYear =
    typeof requestedYearRaw === "string" && Number.isFinite(Number(requestedYearRaw)) ? Number(requestedYearRaw) : undefined;

  const selectedYear = requestedYear !== undefined && availableYears.has(requestedYear) ? requestedYear : periods[0]?.year;

  const selectedStatementTab: StatementTab = parseStatementTab(firstParam(sp.statementType)) ?? BALANCE_TAB;

  const selectedPeriod = selectedYear ? (periods.find((p) => p.year === selectedYear) ?? null) : null;

  const statementTypesToLoad: StatementType[] =
    selectedStatementTab === BALANCE_TAB ? [StatementType.BALANCE_ASSET, StatementType.BALANCE_LIAB] : [selectedStatementTab];

  const lineItemsByType = new Map<
    StatementType,
    Array<{ code: string; label: string; unit: Unit; isInput: boolean; parentCode: string | null; sortOrder: number }>
  >();
  for (const st of statementTypesToLoad) {
    const lineItemsRaw = await prisma.lineItem.findMany({
      where: { statementType: st },
      orderBy: { sortOrder: "asc" },
      select: { code: true, label: true, unit: true, isInput: true, parentCode: true, sortOrder: true },
    });

    const seenCodes = new Set<string>();
    const lineItems = lineItemsRaw.filter((li) => {
      if (seenCodes.has(li.code)) return false;
      seenCodes.add(li.code);
      return true;
    });

    lineItemsByType.set(st, lineItems);
  }

  const codes = Array.from(lineItemsByType.values()).flatMap((items) => items.map((li) => li.code));
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

  const { formulasByCode } = getStatementCatalog();

  const selectedPrimaryStatementType: StatementType =
    selectedStatementTab === BALANCE_TAB ? StatementType.BALANCE_ASSET : selectedStatementTab;

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Datenverwaltung</h1>
      </header>

      {hospitals.length === 0 ? (
        <div className={styles.notice}>
          Es gibt noch keine Krankenhäuser. Lege zuerst eins in der Hospitalverwaltung an.{" "}
          <Link className={styles.inlineLink} href="/dashboard/hospitals">
            Hospitalverwaltung öffnen
          </Link>
        </div>
      ) : (
        <>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <div className={styles.cardTitle}>Auswahl</div>
                <div className={styles.cardHint}>Wähle Kontext und lade dann die Positionen.</div>
              </div>
            </div>

            {selectedHospitalId ? (
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

                <input type="hidden" name="statementType" value={selectedStatementTab} />

                <div className={styles.filterActions}>
                  <button className={styles.button} type="submit">
                    Anzeigen
                  </button>
                </div>
              </form>
            ) : null}

            {selectedHospitalId ? (
              <div className={styles.tabs}>
                {STATEMENT_TABS.map((tab) => {
                  const qs = new URLSearchParams();
                  qs.set("hospitalId", selectedHospitalId);
                  if (selectedYear) qs.set("year", String(selectedYear));
                  qs.set("statementType", tab);
                  const active = tab === selectedStatementTab;
                  return (
                    <Link key={tab} href={`/dashboard/data?${qs.toString()}`} className={`${styles.tab} ${active ? styles.tabActive : ""}`}>
                      {tabLabel(tab)}
                    </Link>
                  );
                })}
              </div>
            ) : null}

            {selectedHospitalId ? (
              <form action={createPeriod} className={styles.createYear}>
                <input type="hidden" name="hospitalId" value={selectedHospitalId} />
                <input type="hidden" name="statementType" value={selectedStatementTab} />
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
            ) : null}
          </div>

          {!selectedPeriod ? (
            <div className={styles.notice}>Bitte wähle ein Jahr aus (oder lege eins an).</div>
          ) : selectedStatementTab === BALANCE_TAB ? (
            <>
              {([StatementType.BALANCE_ASSET, StatementType.BALANCE_LIAB] as const).every(
                (st) => (lineItemsByType.get(st)?.length ?? 0) === 0
              ) ? (
                <div className={styles.notice}>Keine Positionen vorhanden für Bilanz. (Seed noch nicht gelaufen?)</div>
              ) : (
                <>
                  <div className={styles.card}>
                    <div className={styles.cardHeader}>
                      <div>
                        <div className={styles.cardTitle}>Bilanz · Aktiva</div>
                        <div className={styles.cardHint}>
                          {selectedYear} · {hospitals.find((h) => h.id === selectedHospitalId)?.name}
                        </div>
                      </div>
                    </div>

                    <DirtySaveForm
                      key={`${selectedHospitalId}:${selectedPeriod.id}:${StatementType.BALANCE_ASSET}`}
                      saveAction={saveFacts}
                      hospitalId={selectedHospitalId}
                      periodId={selectedPeriod.id}
                      statementType={StatementType.BALANCE_ASSET}
                      rows={buildStatementRows({
                        lineItems: lineItemsByType.get(StatementType.BALANCE_ASSET) ?? [],
                        factMap,
                        formulasByCode,
                      })}
                    />
                  </div>

                  <div className={styles.card}>
                    <div className={styles.cardHeader}>
                      <div>
                        <div className={styles.cardTitle}>Bilanz · Passiva</div>
                        <div className={styles.cardHint}>
                          {selectedYear} · {hospitals.find((h) => h.id === selectedHospitalId)?.name}
                        </div>
                      </div>
                    </div>

                    <DirtySaveForm
                      key={`${selectedHospitalId}:${selectedPeriod.id}:${StatementType.BALANCE_LIAB}`}
                      saveAction={saveFacts}
                      hospitalId={selectedHospitalId}
                      periodId={selectedPeriod.id}
                      statementType={StatementType.BALANCE_LIAB}
                      rows={buildStatementRows({
                        lineItems: lineItemsByType.get(StatementType.BALANCE_LIAB) ?? [],
                        factMap,
                        formulasByCode,
                      })}
                    />
                  </div>
                </>
              )}
            </>
          ) : (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <div className={styles.cardTitle}>{statementLabel(selectedPrimaryStatementType)}</div>
                  <div className={styles.cardHint}>
                    {selectedYear} · {hospitals.find((h) => h.id === selectedHospitalId)?.name}
                  </div>
                </div>
              </div>

              <DirtySaveForm
                key={`${selectedHospitalId}:${selectedPeriod.id}:${selectedPrimaryStatementType}`}
                saveAction={saveFacts}
                hospitalId={selectedHospitalId}
                periodId={selectedPeriod.id}
                statementType={selectedPrimaryStatementType}
                rows={buildStatementRows({
                  lineItems: lineItemsByType.get(selectedPrimaryStatementType) ?? [],
                  factMap,
                  formulasByCode,
                })}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}

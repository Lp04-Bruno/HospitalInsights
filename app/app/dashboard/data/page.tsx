import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getServerAuthSession } from "@/lib/auth";
import { statementLabel } from "@/lib/statements";
import { getStatementCatalog } from "@/lib/statementCatalog";
import { StatementType, Unit } from "@prisma/client";
import styles from "./page.module.css";
import { parseUserNumberDetailed } from "@/app/dashboard/data/numberParsing";
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

type SaveFactsState = {
  ok: boolean;
  message?: string;
  globalError?: string;
  savedAt?: string;
  savedBy?: string;
  changesApplied?: number;
  fieldErrors?: Record<string, string>;
};

function formatNumberDE(value: number, unit: Unit): string {
  const maximumFractionDigits = unit === Unit.PERCENT ? 2 : 0;
  return new Intl.NumberFormat("de-DE", {
    useGrouping: true,
    maximumFractionDigits,
    minimumFractionDigits: 0,
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
  isCollapsible: boolean;
  prettyValue: string;
  suggestedPrettyValue?: string;
};

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

async function saveFacts(prevState: SaveFactsState, formData: FormData): Promise<SaveFactsState> {
  "use server";

  const hospitalId = String(formData.get("hospitalId") ?? "");
  const periodId = String(formData.get("periodId") ?? "");
  const statementType = String(formData.get("statementType") ?? "") as StatementType;

  const session = await getServerAuthSession();
  if (!session) return { ok: false, globalError: "Nicht angemeldet." };
  if (session.user.role !== "ADMIN" && session.user.role !== "EDITOR") {
    return { ok: false, globalError: "Keine Berechtigung." };
  }

  if (!hospitalId || !periodId || !statementType) {
    return { ok: false, globalError: "Ungültige Anfrage." };
  }

  try {
    await prisma.hospitalPeriod.upsert({
      where: { hospitalId_periodId: { hospitalId, periodId } },
      update: {},
      create: { hospitalId, periodId },
    });
  } catch {
    // ignore
  }

  const inputItemsRaw = await prisma.lineItem.findMany({
    where: { statementType, isInput: true },
    orderBy: { sortOrder: "asc" },
  });

  // Defensive: avoid duplicate inputs if line items contain duplicate codes.
  const seenInputCodes = new Set<string>();
  const inputItems = inputItemsRaw.filter((li) => {
    if (seenInputCodes.has(li.code)) return false;
    seenInputCodes.add(li.code);
    return true;
  });

  const presentValueKeys = new Set<string>();
  for (const [k] of formData.entries()) {
    if (typeof k === "string" && k.startsWith("v:")) presentValueKeys.add(k);
  }

  const presentItems = inputItems.filter((i) => presentValueKeys.has(`v:${i.code}`));
  if (presentItems.length === 0) {
    return { ok: true, message: "Keine sichtbaren Felder zum Speichern." };
  }

  const fieldErrors: Record<string, string> = {};
  const desiredByCode = new Map<string, number | null>();

  for (const item of presentItems) {
    const key = `v:${item.code}`;
    const raw = String(formData.get(key) ?? "");
    const parsed = parseUserNumberDetailed(raw, item.unit);

    if (parsed.kind === "invalid") {
      fieldErrors[item.code] = item.unit === Unit.PERCENT ? "Ungültige Prozentzahl." : "Ungültige Zahl.";
      continue;
    }

    if (parsed.kind === "empty") {
      desiredByCode.set(item.code, null);
      continue;
    }

    const rounded = Math.round(parsed.value * 100) / 100;
    desiredByCode.set(item.code, rounded);
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      globalError: "Bitte korrigiere die markierten Felder. Es wurde nichts gespeichert.",
      fieldErrors,
    };
  }

  const codes = presentItems.map((i) => i.code);
  const existing = await prisma.factValue.findMany({
    where: {
      hospitalId,
      periodId,
      lineItemCode: { in: codes },
    },
    select: { lineItemCode: true, value: true },
  });

  const existingByCode = new Map<string, number | null>();
  for (const v of existing) {
    const n = v.value === null ? null : Number(v.value.toString());
    existingByCode.set(v.lineItemCode, Number.isFinite(n as number) ? (n as number) : null);
  }

  const changes: Array<{ code: string; unit: Unit; before: number | null; after: number | null }> = [];
  for (const item of presentItems) {
    const after = desiredByCode.get(item.code) ?? null;
    const before = existingByCode.get(item.code) ?? null;
    if (before === after) continue;
    changes.push({ code: item.code, unit: item.unit, before, after });
  }

  if (changes.length === 0) {
    return { ok: true, message: "Keine Änderungen zum Speichern." };
  }

  const now = new Date();
  const savedBy = session.user.email ?? session.user.name ?? "";
  const sessionEmail = session.user.email ?? "";
  const dbUser = sessionEmail ? await prisma.user.findUnique({ where: { email: sessionEmail }, select: { id: true } }) : null;
  const dbUserId = dbUser?.id ?? null;

  try {
    await prisma.$transaction(async (tx) => {
      const run = await tx.factChangeRun.create({
        data: {
          hospitalId,
          periodId,
          statementType,
          userId: dbUserId,
          createdAt: now,
        },
        select: { id: true },
      });

      for (const c of changes) {
        if (c.after === null) {
          await tx.factValue.deleteMany({ where: { hospitalId, periodId, lineItemCode: c.code } });
        } else {
          await tx.factValue.upsert({
            where: {
              hospitalId_periodId_lineItemCode: {
                hospitalId,
                periodId,
                lineItemCode: c.code,
              },
            },
            update: { value: c.after },
            create: { hospitalId, periodId, lineItemCode: c.code, value: c.after },
          });
        }

        await tx.factChange.create({
          data: {
            runId: run.id,
            hospitalId,
            periodId,
            statementType,
            lineItemCode: c.code,
            unit: c.unit,
            beforeValue: c.before,
            afterValue: c.after,
            createdAt: now,
          },
        });
      }
    });
  } catch (err) {
    console.error("saveFacts failed", { hospitalId, periodId, statementType, userId: session.user.id }, err);
    return {
      ok: false,
      globalError: "Speichern fehlgeschlagen (Datenbankfehler). Es wurden keine Änderungen übernommen.",
    };
  }

  return {
    ok: true,
    message: "Gespeichert.",
    savedAt: now.toISOString(),
    savedBy: savedBy || undefined,
    changesApplied: changes.length,
  };
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

  const alwaysExpanded = new Set<string>([
    // UKV
    "UKV__VVK",
    "UKV__MAT",
    "UKV__PER",
    "UKV__STEUERN",
    // GKV
    "GKV__MAT",
    "GKV__PER",
    "GKV__STEUERN",
  ]);

  function buildFlatRows(st: StatementType): FlatRow[] {
    const lineItems = lineItemsByType.get(st) ?? [];
    const byCode = new Map(lineItems.map((li) => [li.code, li] as const));
    const childrenByCode = new Map<string, string[]>();

    for (const li of lineItems) {
      if (!li.parentCode) continue;
      const arr = childrenByCode.get(li.parentCode) ?? [];
      arr.push(li.code);
      childrenByCode.set(li.parentCode, arr);
    }

    const depthMemo = new Map<string, number>();
    const computeDepth = (code: string, visiting = new Set<string>()): number => {
      const cached = depthMemo.get(code);
      if (cached !== undefined) return cached;

      if (visiting.has(code)) {
        depthMemo.set(code, 0);
        return 0;
      }

      const li = byCode.get(code);
      if (!li?.parentCode) {
        depthMemo.set(code, 0);
        return 0;
      }

      visiting.add(code);
      const out = computeDepth(li.parentCode, visiting) + 1;
      visiting.delete(code);
      depthMemo.set(code, out);
      return out;
    };

    const overrideNumericByCode = new Map<string, number>();
    for (const li of lineItems) {
      const raw = factMap.get(li.code);
      if (!raw) continue;
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      overrideNumericByCode.set(li.code, n);
    }

    const hasChildrenByCode = new Map<string, boolean>();
    const hasFormulaByCode = new Map<string, boolean>();
    const childrenAllDavonByCode = new Map<string, boolean>();
    const isEditableByCode = new Map<string, boolean>();
    for (const li of lineItems) {
      const hasChildren = (childrenByCode.get(li.code)?.length ?? 0) > 0;
      const hasFormula = (formulasByCode.get(li.code)?.length ?? 0) > 0;

      const children = childrenByCode.get(li.code) ?? [];
      const eurChildren = children
        .map((childCode) => byCode.get(childCode))
        .filter((c): c is NonNullable<typeof c> => !!c)
        .filter((c) => c.unit === Unit.EUR);
      const childrenAllDavon =
        eurChildren.length > 0 &&
        eurChildren.every((child) => {
          const label = child.label?.trim() ?? "";
          return /^davon\b/i.test(label);
        });

      hasChildrenByCode.set(li.code, hasChildren);
      hasFormulaByCode.set(li.code, hasFormula);

      childrenAllDavonByCode.set(li.code, childrenAllDavon);

      const isEditable = li.isInput && (!hasChildren || childrenAllDavon) && (!hasFormula || childrenAllDavon);
      isEditableByCode.set(li.code, isEditable);
    }

    const computedCache = new Map<string, number | null>();
    const computeValue = (code: string, visiting = new Set<string>()): number | null => {
      if (computedCache.has(code)) return computedCache.get(code) ?? null;

      if (isEditableByCode.get(code)) {
        const override = overrideNumericByCode.get(code);
        if (override !== undefined) {
          computedCache.set(code, override);
          return override;
        }
      }

      if (visiting.has(code)) {
        computedCache.set(code, null);
        return null;
      }

      visiting.add(code);

      const li = byCode.get(code);
      if (!li) {
        visiting.delete(code);
        computedCache.set(code, null);
        return null;
      }

      const formula = formulasByCode.get(code);
      if (formula?.length) {
        let sum = 0;
        let hasAny = false;
        for (const ref of formula) {
          const v = computeValue(ref.code, visiting);
          if (v === null) continue;
          sum += v * ref.weight;
          hasAny = true;
        }

        const out = hasAny ? sum : null;
        visiting.delete(code);
        computedCache.set(code, out);
        return out;
      }

      if (li.unit !== Unit.EUR) {
        visiting.delete(code);
        computedCache.set(code, null);
        return null;
      }

      const children = childrenByCode.get(code) ?? [];
      if (children.length === 0) {
        visiting.delete(code);
        computedCache.set(code, null);
        return null;
      }

      if (childrenAllDavonByCode.get(code)) {
        visiting.delete(code);
        computedCache.set(code, null);
        return null;
      }

      let sum = 0;
      let hasAny = false;
      for (const childCode of children) {
        const child = byCode.get(childCode);
        if (!child || child.unit !== Unit.EUR) continue;
        const v = computeValue(childCode, visiting);
        if (v === null) continue;
        sum += v;
        hasAny = true;
      }

      const out = hasAny ? sum : null;
      visiting.delete(code);
      computedCache.set(code, out);
      return out;
    };

    const rows: FlatRow[] = lineItems.map((li) => {
      const depth = computeDepth(li.code);
      const hasChildren = hasChildrenByCode.get(li.code) ?? false;
      const isEditable = isEditableByCode.get(li.code) ?? false;
      const overrideRaw = isEditable ? factMap.get(li.code) : undefined;
      const computed = computeValue(li.code);

      const isCollapsible = hasChildren && !alwaysExpanded.has(li.code);

      const prettyValue = isEditable ? displayValue(overrideRaw, li.unit) : computed === null ? "" : formatNumberDE(computed, li.unit);

      const suggestedPrettyValue =
        isEditable && !overrideRaw && li.unit === Unit.EUR
          ? computed === null
            ? undefined
            : formatNumberDE(computed, li.unit)
          : undefined;

      return {
        code: li.code,
        depth,
        label: li.label,
        unit: li.unit,
        isInput: isEditable,
        isSection: hasChildren && depth <= 1,
        hasChildren,
        isCollapsible,
        prettyValue,
        suggestedPrettyValue,
      };
    });

    return rows;
  }

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
                      rows={buildFlatRows(StatementType.BALANCE_ASSET)}
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
                      rows={buildFlatRows(StatementType.BALANCE_LIAB)}
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
                rows={buildFlatRows(selectedPrimaryStatementType)}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}

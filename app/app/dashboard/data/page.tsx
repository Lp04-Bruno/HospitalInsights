import { redirect } from "next/navigation";
import type { ReactElement } from "react";
import { prisma } from "@/lib/prisma";
import { getServerAuthSession } from "@/lib/auth";
import { StatementType, Unit } from "@prisma/client";
import styles from "./page.module.css";

type PageProps = {
  searchParams?: {
    hospitalId?: string;
    year?: string;
    statementType?: StatementType;
    saved?: string;
  };
};

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

async function createPeriod(formData: FormData) {
  "use server";
  const yearRaw = String(formData.get("year") ?? "").trim();
  const year = Number(yearRaw);

  const hospitalId = String(formData.get("hospitalId") ?? "").trim();
  if (!hospitalId) redirect("/dashboard/data");

  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    redirect(`/dashboard/data?hospitalId=${encodeURIComponent(hospitalId)}`);
  }

  await prisma.period.upsert({
    where: { year },
    update: {},
    create: { year },
  });

  redirect(
    `/dashboard/data?hospitalId=${encodeURIComponent(hospitalId)}&year=${year}`
  );
}

async function saveFacts(formData: FormData) {
  "use server";

  const hospitalId = String(formData.get("hospitalId") ?? "");
  const periodId = String(formData.get("periodId") ?? "");
  const statementType = String(formData.get("statementType") ?? "") as StatementType;

  if (!hospitalId || !periodId || !statementType) redirect("/dashboard/data");

  const lineItems = await prisma.lineItem.findMany({
    where: { statementType },
    orderBy: { sortOrder: "asc" },
  });

  for (const item of lineItems) {
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

export default async function DashboardDataPage({ searchParams }: PageProps) {
  const session = await getServerAuthSession();
  if (!session) redirect("/signin?callbackUrl=/dashboard/data");
  if (session.user.role !== "ADMIN" && session.user.role !== "EDITOR") {
    redirect("/dashboard/forbidden");
  }

  const hospitals = await prisma.hospital.findMany({
    orderBy: { name: "asc" },
  });

  const selectedHospitalId =
    typeof searchParams?.hospitalId === "string" && searchParams.hospitalId
      ? searchParams.hospitalId
      : hospitals[0]?.id;

  const periods = await prisma.period.findMany({ orderBy: { year: "desc" } });

  const selectedYear =
    typeof searchParams?.year === "string" && Number.isFinite(Number(searchParams.year))
      ? Number(searchParams.year)
      : periods[0]?.year;

  const selectedStatementType: StatementType =
    (searchParams?.statementType as StatementType) ?? StatementType.BALANCE_ASSET;

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

  // Build a tree for indentation
  const childrenByParent = new Map<string, string[]>();
  const rootCodes: string[] = [];
  for (const li of lineItems) {
    if (li.parentCode) {
      const arr = childrenByParent.get(li.parentCode) ?? [];
      arr.push(li.code);
      childrenByParent.set(li.parentCode, arr);
    } else {
      rootCodes.push(li.code);
    }
  }
  const itemByCode = new Map(lineItems.map((li) => [li.code, li] as const));

  const renderRows = (code: string, depth: number): ReactElement[] => {
    const item = itemByCode.get(code);
    if (!item) return [];

    const paddingLeft = 8 + depth * 18;
    const valueKey = `v:${item.code}`;
    const defaultValue = factMap.get(item.code) ?? "";

    const rows: ReactElement[] = [
      <tr key={item.code}>
        <td className={styles.td}>
          <div className={styles.itemLabel} style={{ paddingLeft }}>
            {item.label}
          </div>
          <span className={styles.itemMeta} style={{ paddingLeft }}>
            {unitSuffix(item.unit)}
          </span>
        </td>
        <td className={styles.td}>
          <input
            name={valueKey}
            className={styles.valueInput}
            defaultValue={defaultValue}
            placeholder={item.unit === Unit.PERCENT ? "z.B. 39" : ""}
            inputMode={item.unit === Unit.COUNT ? "numeric" : "decimal"}
            disabled={!item.isInput}
          />
        </td>
      </tr>,
    ];

    const children = childrenByParent.get(item.code) ?? [];
    for (const childCode of children) {
      rows.push(...renderRows(childCode, depth + 1));
    }

    return rows;
  };

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Datenverwaltung</h1>
        <p className={styles.subtitle}>
          Werte pro Krankenhaus, Jahr und Bereich erfassen (analog zur Eingabe-Tabelle).
        </p>
      </header>

      {searchParams?.saved === "1" && <div className={styles.notice}>Gespeichert.</div>}

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

            <label className={styles.field}>
              Bereich
              <select name="statementType" className={styles.select} defaultValue={selectedStatementType}>
                {Object.values(StatementType).map((st) => (
                  <option key={st} value={st}>
                    {statementLabel(st)}
                  </option>
                ))}
              </select>
            </label>

            <div className={styles.filterActions}>
              <button className={styles.button} type="submit">
                Anzeigen
              </button>
            </div>
          </form>
        )}

        {selectedHospitalId && (
          <form action={createPeriod} className={styles.createYear}>
            <input type="hidden" name="hospitalId" value={selectedHospitalId} />
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

            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Position</th>
                  <th className={styles.th}>Wert</th>
                </tr>
              </thead>
              <tbody>{rootCodes.flatMap((code) => renderRows(code, 0))}</tbody>
            </table>

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

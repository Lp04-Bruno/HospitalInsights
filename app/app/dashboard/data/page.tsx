import Link from "next/link";
import { statementLabel } from "@/lib/statements";
import { EDITOR_ROLES, requireAnyRole } from "@/lib/access";
import { saveFacts } from "@/lib/facts/saveFacts";
import { buildStatementRows } from "@/lib/facts/statementRows";
import { createPeriod } from "@/lib/facts/periods";
import { BALANCE_TAB, loadStatementContext, STATEMENT_TABS, tabLabel } from "@/lib/facts/loadStatementContext";
import { resolveSearchParams } from "@/lib/validation";
import { StatementType } from "@/prisma/generated/enums";
import styles from "./page.module.css";
import { DirtySaveForm } from "@/app/dashboard/data/DirtySaveForm";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
};

async function requireDataAccess() {
  return requireAnyRole(EDITOR_ROLES, "/dashboard/data");
}

export default async function DashboardDataPage({ searchParams }: PageProps) {
  await requireDataAccess();

  const sp = await resolveSearchParams(searchParams);
  const {
    hospitals,
    periods,
    selectedHospitalId,
    selectedYear,
    selectedPeriod,
    selectedStatementTab,
    selectedPrimaryStatementType,
    lineItemsByType,
    factMap,
    formulasByCode,
  } = await loadStatementContext(sp);

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

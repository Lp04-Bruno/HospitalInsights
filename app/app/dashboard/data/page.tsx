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
import {
  DashboardActions,
  DashboardButton,
  DashboardCard,
  DashboardField,
  DashboardHeader,
  DashboardNotice,
  DashboardPage,
  dashboardUi,
} from "@/app/dashboard/_components/DashboardUi";

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
  const selectedHospitalName = hospitals.find((h) => h.id === selectedHospitalId)?.name ?? "—";

  return (
    <DashboardPage>
      <DashboardHeader title="Datenverwaltung" />

      {hospitals.length === 0 ? (
        <DashboardNotice>
          Es gibt noch keine Krankenhäuser. Lege zuerst eins in der Hospitalverwaltung an.{" "}
          <Link className={styles.inlineLink} href="/dashboard/hospitals">
            Hospitalverwaltung öffnen
          </Link>
        </DashboardNotice>
      ) : (
        <>
          <DashboardCard title="Auswahl" hint="Wähle Kontext und lade dann die Positionen.">
            {selectedHospitalId ? (
              <form method="get" className={styles.filters}>
                <DashboardField label="Krankenhaus">
                  <select name="hospitalId" className={dashboardUi.select} defaultValue={selectedHospitalId}>
                    {hospitals.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </DashboardField>

                <DashboardField label="Jahr">
                  <select name="year" className={dashboardUi.select} defaultValue={selectedYear ?? ""}>
                    {periods.map((p) => (
                      <option key={p.id} value={p.year}>
                        {p.year}
                      </option>
                    ))}
                  </select>
                </DashboardField>

                <input type="hidden" name="statementType" value={selectedStatementTab} />

                <DashboardActions className={styles.filterActions}>
                  <DashboardButton type="submit">Anzeigen</DashboardButton>
                </DashboardActions>
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
                <DashboardField label="Jahr anlegen">
                  <input name="year" className={dashboardUi.input} placeholder="z.B. 2024" />
                </DashboardField>
                <DashboardActions className={styles.filterActions}>
                  <DashboardButton tone="secondary" type="submit">
                    Jahr anlegen
                  </DashboardButton>
                </DashboardActions>
              </form>
            ) : null}
          </DashboardCard>

          {!selectedPeriod ? (
            <DashboardNotice>Bitte wähle ein Jahr aus (oder lege eins an).</DashboardNotice>
          ) : selectedStatementTab === BALANCE_TAB ? (
            <>
              {([StatementType.BALANCE_ASSET, StatementType.BALANCE_LIAB] as const).every(
                (st) => (lineItemsByType.get(st)?.length ?? 0) === 0
              ) ? (
                <DashboardNotice tone="warning">Keine Positionen vorhanden für Bilanz. (Seed noch nicht gelaufen?)</DashboardNotice>
              ) : (
                <>
                  <DashboardCard title="Bilanz · Aktiva" hint={`${selectedYear} · ${selectedHospitalName}`}>
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
                  </DashboardCard>

                  <DashboardCard title="Bilanz · Passiva" hint={`${selectedYear} · ${selectedHospitalName}`}>
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
                  </DashboardCard>
                </>
              )}
            </>
          ) : (
            <DashboardCard title={statementLabel(selectedPrimaryStatementType)} hint={`${selectedYear} · ${selectedHospitalName}`}>
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
            </DashboardCard>
          )}
        </>
      )}
    </DashboardPage>
  );
}

import { prisma } from "@/lib/prisma";
import { statementLabel } from "@/lib/statements";
import { getStatementCatalog } from "@/lib/statementCatalog";
import type { StatementLineItem } from "@/lib/facts/types";
import { firstSearchParam, parseStatementType, yearSchema } from "@/lib/validation";
import { StatementType } from "@/prisma/generated/enums";

export const BALANCE_TAB = "BALANCE" as const;

export type StatementTab = typeof BALANCE_TAB | StatementType;

export const STATEMENT_TABS: StatementTab[] = [
  BALANCE_TAB,
  StatementType.INCOME_STATEMENT_UKV,
  StatementType.INCOME_STATEMENT_GKV,
  StatementType.CASHFLOW,
];

export type StatementSearchParams = Record<string, string | string[] | undefined>;

export function parseStatementTab(raw: string | undefined): StatementTab | undefined {
  if (!raw) return undefined;
  if (raw === BALANCE_TAB) return BALANCE_TAB;

  const parsed = parseStatementType(raw);
  if (!parsed) return undefined;
  if (parsed === StatementType.BALANCE_ASSET || parsed === StatementType.BALANCE_LIAB) return BALANCE_TAB;
  return parsed;
}

export function tabLabel(tab: StatementTab): string {
  if (tab === BALANCE_TAB) return "Bilanz";
  return statementLabel(tab);
}

function uniqueLineItems(lineItems: StatementLineItem[]): StatementLineItem[] {
  const seenCodes = new Set<string>();
  return lineItems.filter((li) => {
    if (seenCodes.has(li.code)) return false;
    seenCodes.add(li.code);
    return true;
  });
}

export async function loadStatementContext(sp: StatementSearchParams) {
  const hospitals = await prisma.hospital.findMany({
    orderBy: { name: "asc" },
  });

  const selectedHospitalId = firstSearchParam(sp.hospitalId) || hospitals[0]?.id;

  const hospitalPeriods = selectedHospitalId
    ? await prisma.hospitalPeriod.findMany({
        where: { hospitalId: selectedHospitalId },
        include: { period: { select: { id: true, year: true } } },
        orderBy: { period: { year: "desc" } },
      })
    : [];

  const periods = hospitalPeriods.map((hp) => hp.period);
  const availableYears = new Set(periods.map((p) => p.year));
  const requestedYearResult = yearSchema.safeParse(firstSearchParam(sp.year));
  const requestedYear = requestedYearResult.success ? requestedYearResult.data : undefined;
  const selectedYear = requestedYear !== undefined && availableYears.has(requestedYear) ? requestedYear : periods[0]?.year;
  const selectedPeriod = selectedYear ? (periods.find((p) => p.year === selectedYear) ?? null) : null;

  const selectedStatementTab: StatementTab = parseStatementTab(firstSearchParam(sp.statementType)) ?? BALANCE_TAB;
  const selectedPrimaryStatementType: StatementType =
    selectedStatementTab === BALANCE_TAB ? StatementType.BALANCE_ASSET : selectedStatementTab;
  const statementTypesToLoad: StatementType[] =
    selectedStatementTab === BALANCE_TAB ? [StatementType.BALANCE_ASSET, StatementType.BALANCE_LIAB] : [selectedStatementTab];

  const lineItemsByType = new Map<StatementType, StatementLineItem[]>();
  for (const st of statementTypesToLoad) {
    const lineItemsRaw = await prisma.lineItem.findMany({
      where: { statementType: st },
      orderBy: { sortOrder: "asc" },
      select: { code: true, label: true, unit: true, isInput: true, parentCode: true, sortOrder: true },
    });

    lineItemsByType.set(st, uniqueLineItems(lineItemsRaw));
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

  return {
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
  };
}

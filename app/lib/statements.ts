import { StatementType } from "@prisma/client";

export function statementLabel(st: StatementType) {
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
      return "Sonstiges";
    default:
      return st;
  }
}

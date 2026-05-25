import { describe, expect, it } from "vitest";

import { buildStatementRows } from "@/lib/facts/statementRows";
import type { StatementLineItem } from "@/lib/facts/types";
import type { CatalogFormulaByCode } from "@/lib/statementCatalog";
import { Unit } from "@/prisma/generated/enums";

const lineItems: StatementLineItem[] = [
  { code: "TOTAL", label: "Gesamt", unit: Unit.EUR, isInput: false, parentCode: null },
  { code: "A", label: "A", unit: Unit.EUR, isInput: true, parentCode: "TOTAL" },
  { code: "B", label: "B", unit: Unit.EUR, isInput: true, parentCode: "TOTAL" },
  { code: "FORMULA", label: "Formel", unit: Unit.EUR, isInput: false, parentCode: null },
];

describe("buildStatementRows", () => {
  it("builds tree metadata and sums EUR child values", () => {
    const rows = buildStatementRows({
      lineItems,
      factMap: new Map([
        ["A", "100"],
        ["B", "50"],
      ]),
      formulasByCode: new Map(),
    });

    expect(rows.find((row) => row.code === "TOTAL")).toMatchObject({
      depth: 0,
      hasChildren: true,
      isInput: false,
      prettyValue: "150",
    });
    expect(rows.find((row) => row.code === "A")).toMatchObject({
      depth: 1,
      hasChildren: false,
      isInput: true,
      prettyValue: "100",
    });
  });

  it("computes formulas from referenced rows", () => {
    const formulasByCode: CatalogFormulaByCode = new Map([
      [
        "FORMULA",
        [
          { code: "A", weight: 1 },
          { code: "B", weight: -1 },
        ],
      ],
    ]);

    const rows = buildStatementRows({
      lineItems,
      factMap: new Map([
        ["A", "100"],
        ["B", "40"],
      ]),
      formulasByCode,
    });

    expect(rows.find((row) => row.code === "FORMULA")).toMatchObject({
      isInput: false,
      prettyValue: "60",
    });
  });
});

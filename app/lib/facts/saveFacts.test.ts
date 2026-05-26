import { beforeEach, describe, expect, it, vi } from "vitest";

import { Unit } from "@/prisma/generated/enums";

const prismaMock = vi.hoisted(() => ({
  hospitalPeriod: {
    upsert: vi.fn(),
  },
  lineItem: {
    findMany: vi.fn(),
  },
  factValue: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const getSessionIfAllowedMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/access", () => ({
  EDITOR_ROLES: ["ADMIN", "EDITOR"],
  getSessionIfAllowed: getSessionIfAllowedMock,
}));

const { saveFacts } = await import("@/lib/facts/saveFacts");

function createForm(value: string): FormData {
  const form = new FormData();
  form.set("hospitalId", "h1");
  form.set("periodId", "p1");
  form.set("statementType", "BALANCE_ASSET");
  form.set("v:A", value);
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();

  getSessionIfAllowedMock.mockResolvedValue({
    user: { id: "u1", email: "editor@example.test", name: null },
  });
  prismaMock.hospitalPeriod.upsert.mockResolvedValue({});
  prismaMock.lineItem.findMany.mockResolvedValue([{ code: "A", unit: Unit.EUR, sortOrder: 1 }]);
});

describe("saveFacts", () => {
  it("does not write a transaction when visible values did not change", async () => {
    prismaMock.factValue.findMany.mockResolvedValue([{ lineItemCode: "A", value: { toString: () => "100" } }]);

    const result = await saveFacts({ ok: true }, createForm("100"));

    expect(result).toEqual({ ok: true, message: "Keine Änderungen zum Speichern." });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("detects changed values and records fact/audit writes in one transaction", async () => {
    prismaMock.factValue.findMany.mockResolvedValue([{ lineItemCode: "A", value: { toString: () => "100" } }]);

    const tx = {
      factChangeRun: {
        create: vi.fn().mockResolvedValue({ id: "run1" }),
      },
      factValue: {
        deleteMany: vi.fn(),
        upsert: vi.fn(),
      },
      factChange: {
        create: vi.fn(),
      },
    };
    prismaMock.$transaction.mockImplementation(async (callback: (transaction: typeof tx) => Promise<void>) => callback(tx));

    const result = await saveFacts({ ok: true }, createForm("120"));

    expect(result).toMatchObject({ ok: true, message: "Gespeichert.", savedBy: "editor@example.test", changesApplied: 1 });
    expect(tx.factValue.upsert).toHaveBeenCalledWith({
      where: {
        hospitalId_periodId_lineItemCode: {
          hospitalId: "h1",
          periodId: "p1",
          lineItemCode: "A",
        },
      },
      update: { value: 120 },
      create: { hospitalId: "h1", periodId: "p1", lineItemCode: "A", value: 120 },
    });
    expect(tx.factChange.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        runId: "run1",
        hospitalId: "h1",
        periodId: "p1",
        statementType: "BALANCE_ASSET",
        lineItemCode: "A",
        unit: Unit.EUR,
        beforeValue: 100,
        afterValue: 120,
      }),
    });
  });
});

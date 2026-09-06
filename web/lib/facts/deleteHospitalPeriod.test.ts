import { beforeEach, describe, expect, it, vi } from "vitest";

const txMock = vi.hoisted(() => ({
  factChangeRun: { deleteMany: vi.fn() },
  factValue: { deleteMany: vi.fn() },
  hospitalPeriod: { deleteMany: vi.fn() },
}));

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

const { deleteHospitalPeriod } = await import("@/lib/facts/deleteHospitalPeriod");

const input = { hospitalId: "h1", periodId: "p1" };
const where = { where: { hospitalId: "h1", periodId: "p1" } };

beforeEach(() => {
  prismaMock.$transaction.mockImplementation(async (callback: (transaction: typeof txMock) => Promise<number>) => callback(txMock));
  txMock.factChangeRun.deleteMany.mockResolvedValue({ count: 3 });
  txMock.factValue.deleteMany.mockResolvedValue({ count: 42 });
  txMock.hospitalPeriod.deleteMany.mockResolvedValue({ count: 1 });
});

describe("deleteHospitalPeriod", () => {
  it("löscht Audit-Runs, Werte und Zuordnung in einer einzigen Transaktion", async () => {
    await deleteHospitalPeriod(input);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(txMock.factChangeRun.deleteMany).toHaveBeenCalledWith(where);
    expect(txMock.factValue.deleteMany).toHaveBeenCalledWith(where);
    expect(txMock.hospitalPeriod.deleteMany).toHaveBeenCalledWith(where);
  });

  it("gibt die Anzahl der entfernten Werte zurück", async () => {
    await expect(deleteHospitalPeriod(input)).resolves.toBe(42);
  });

  it("reicht einen Fehler durch, damit die Transaktion zurückgerollt wird", async () => {
    txMock.factValue.deleteMany.mockRejectedValueOnce(new Error("db weg"));

    await expect(deleteHospitalPeriod(input)).rejects.toThrow("db weg");
    expect(txMock.hospitalPeriod.deleteMany).not.toHaveBeenCalled();
  });
});

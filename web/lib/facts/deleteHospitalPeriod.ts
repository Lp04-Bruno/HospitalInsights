import { prisma } from "@/lib/prisma";

export type DeleteHospitalPeriodInput = {
  hospitalId: string;
  periodId: string;
};

/**
 * Entfernt ein Jahr eines Krankenhauses samt Werten und Audit-Historie.
 *
 * @returns Anzahl der entfernten Werte.
 */
export async function deleteHospitalPeriod({ hospitalId, periodId }: DeleteHospitalPeriodInput): Promise<number> {
  const where = { hospitalId, periodId };

  return prisma.$transaction(async (tx) => {
    await tx.factChangeRun.deleteMany({ where });
    const removedValues = await tx.factValue.deleteMany({ where });
    await tx.hospitalPeriod.deleteMany({ where });

    return removedValues.count;
  });
}

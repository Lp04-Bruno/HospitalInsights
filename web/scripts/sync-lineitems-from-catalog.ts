import "dotenv/config";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../prisma/generated/client";
import { StatementType, Unit } from "../prisma/generated/enums";

import { getStatementCatalog } from "../lib/statementCatalog";

config({ path: "../infra/.env", quiet: true });

type DbLineItem = {
  code: string;
  label: string;
  statementType: StatementType;
  parentCode: string | null;
  sortOrder: number;
  unit: Unit;
  isInput: boolean;
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });
  try {
    const { lineItems } = getStatementCatalog();

    const existing = await prisma.lineItem.findMany({
      select: {
        code: true,
        label: true,
        statementType: true,
        parentCode: true,
        sortOrder: true,
        unit: true,
        isInput: true,
      },
    });

    const existingByCode = new Map<string, DbLineItem>(existing.map((li) => [li.code, li] as const));
    const catalogByType = new Map<StatementType, typeof lineItems>();
    for (const li of lineItems) {
      const arr = catalogByType.get(li.statementType) ?? [];
      arr.push(li);
      catalogByType.set(li.statementType, arr);
    }

    let created = 0;
    let updated = 0;

    for (const [statementType, catalogItems] of catalogByType.entries()) {
      const existingForType = existing.filter((li) => li.statementType === statementType);

      // Stage 1: move all existing rows of that statementType into a high, unique range
      // so we can apply the final catalog sortOrder without collisions.
      const maxSortOrder = Math.max(0, ...existingForType.map((li) => li.sortOrder));
      const tempStart = maxSortOrder + 10_000;

      // Assign strictly-unique temporary sort orders to avoid collisions.
      const existingSorted = [...existingForType].sort((a, b) => a.code.localeCompare(b.code));
      for (let start = 0; start < existingSorted.length; start += 50) {
        const batch = existingSorted.slice(start, start + 50);
        await prisma.$transaction(
          batch.map((li, i) =>
            prisma.lineItem.update({
              where: { code: li.code },
              data: { sortOrder: tempStart + start + i },
            })
          )
        );
      }

      // Stage 2: create missing catalog items (use temporary sortOrder to avoid collisions)
      const toCreateForType = [] as typeof lineItems;
      let tempCreateOffset = 0;
      for (const li of catalogItems) {
        if (existingByCode.has(li.code)) continue;
        toCreateForType.push({ ...li, sortOrder: tempStart + 50_000 + tempCreateOffset });
        tempCreateOffset += 1;
      }
      if (toCreateForType.length) {
        await prisma.lineItem.createMany({ data: toCreateForType });
        created += toCreateForType.length;
      }

      // Stage 3: apply final metadata + sortOrder for catalog items.
      // IMPORTANT: do not skip updates based on a stale snapshot — we just staged sortOrder
      // into a temporary range, so every catalog item must be brought back to its final order.
      const finalOps = catalogItems.map((li) =>
        prisma.lineItem.update({
          where: { code: li.code },
          data: {
            label: li.label,
            statementType: li.statementType,
            parentCode: li.parentCode,
            sortOrder: li.sortOrder,
            unit: li.unit,
            isInput: li.isInput,
          },
        })
      );

      for (const batch of chunk(finalOps, 50)) {
        await prisma.$transaction(batch);
        updated += batch.length;
      }
    }

    // Intentionally non-destructive: we don't delete unknown codes here.
    console.log("[sync-lineitems] done", { created, updated, totalCatalog: lineItems.length });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[sync-lineitems] failed", err);
  process.exit(1);
});

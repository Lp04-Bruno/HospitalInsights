const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function pad4(n) {
  return String(n).padStart(4, "0");
}

function isNumericSortCode(code, sortOrder) {
  return code.includes(`_${pad4(sortOrder)}_`);
}

function decimalsEqual(a, b) {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.toString() === b.toString();
}

function isZeroDecimal(v) {
  if (v === null) return false;
  const n = Number(v.toString());
  return Number.isFinite(n) && n === 0;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const lineItems = await prisma.lineItem.findMany({
    select: { code: true, statementType: true, sortOrder: true, label: true, parentCode: true, isInput: true },
    orderBy: [{ statementType: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
  });

  const byKey = new Map();
  for (const li of lineItems) {
    const key = `${li.statementType}::${li.sortOrder}`;
    const arr = byKey.get(key);
    if (arr) arr.push(li);
    else byKey.set(key, [li]);
  }

  const duplicateGroups = [...byKey.values()].filter((arr) => arr.length > 1);
  console.log("LineItems total:", lineItems.length);
  console.log("Duplicate (statementType, sortOrder) groups:", duplicateGroups.length);

  if (!duplicateGroups.length) {
    console.log("No duplicates found. Nothing to do.");
    return;
  }

  for (const group of duplicateGroups.slice(0, 20)) {
    console.log(
      "\nDUP:",
      { statementType: group[0].statementType, sortOrder: group[0].sortOrder },
      group.map((x) => ({ code: x.code, label: x.label, parentCode: x.parentCode })),
    );
  }

  if (!apply) {
    console.log("\nDry-run only. Re-run with --apply to perform cleanup.");
    return;
  }

  const conflicts = [];

  try {
    await prisma.$transaction(async (tx) => {
      for (const group of duplicateGroups) {
      const sortOrder = group[0].sortOrder;
      const statementType = group[0].statementType;

      const groupCodes = group.map((x) => x.code);
      const factRowsForGroup = await tx.factValue.findMany({
        where: { lineItemCode: { in: groupCodes } },
        select: { lineItemCode: true, value: true },
      });

      const usage = new Map();
      for (const c of groupCodes) usage.set(c, { total: 0, nonNull: 0 });
      for (const r of factRowsForGroup) {
        const u = usage.get(r.lineItemCode);
        if (!u) continue;
        u.total += 1;
        if (r.value !== null) u.nonNull += 1;
      }

      const canonical = [...group].sort((a, b) => {
        const ua = usage.get(a.code) || { total: 0, nonNull: 0 };
        const ub = usage.get(b.code) || { total: 0, nonNull: 0 };
        if (ua.nonNull !== ub.nonNull) return ub.nonNull - ua.nonNull;
        if (ua.total !== ub.total) return ub.total - ua.total;
        const aPref = isNumericSortCode(a.code, sortOrder) ? 1 : 0;
        const bPref = isNumericSortCode(b.code, sortOrder) ? 1 : 0;
        if (aPref !== bPref) return aPref - bPref;
        return a.code.localeCompare(b.code);
      })[0];

      const duplicates = group.filter((x) => x.code !== canonical.code);

      for (const dup of duplicates) {
        const factRows = await tx.factValue.findMany({
          where: { lineItemCode: dup.code },
          select: { id: true, hospitalId: true, periodId: true, value: true },
        });

        for (const fv of factRows) {
          const existing = await tx.factValue.findUnique({
            where: {
              hospitalId_periodId_lineItemCode: {
                hospitalId: fv.hospitalId,
                periodId: fv.periodId,
                lineItemCode: canonical.code,
              },
            },
            select: { id: true, value: true },
          });

          if (!existing) {
            await tx.factValue.create({
              data: {
                hospitalId: fv.hospitalId,
                periodId: fv.periodId,
                lineItemCode: canonical.code,
                value: fv.value,
              },
            });
            await tx.factValue.delete({ where: { id: fv.id } });
            continue;
          }

          if (decimalsEqual(existing.value, fv.value)) {
            await tx.factValue.delete({ where: { id: fv.id } });
            continue;
          }

          if (existing.value === null && fv.value !== null) {
            await tx.factValue.update({ where: { id: existing.id }, data: { value: fv.value } });
            await tx.factValue.delete({ where: { id: fv.id } });
            continue;
          }

          if (existing.value !== null && fv.value === null) {
            await tx.factValue.delete({ where: { id: fv.id } });
            continue;
          }

          if (isZeroDecimal(existing.value) && !isZeroDecimal(fv.value)) {
            await tx.factValue.update({ where: { id: existing.id }, data: { value: fv.value } });
            await tx.factValue.delete({ where: { id: fv.id } });
            continue;
          }

          if (!isZeroDecimal(existing.value) && isZeroDecimal(fv.value)) {
            await tx.factValue.delete({ where: { id: fv.id } });
            continue;
          }

          const conflict = {
            statementType,
            sortOrder,
            label: dup.label,
            canonicalCode: canonical.code,
            duplicateCode: dup.code,
            hospitalId: fv.hospitalId,
            periodId: fv.periodId,
            canonicalValue: existing.value?.toString() ?? null,
            duplicateValue: fv.value?.toString() ?? null,
          };
          conflicts.push(conflict);
          throw new Error(`FactValue conflict while merging line items: ${JSON.stringify(conflict)}`);
        }

        await tx.factChange.updateMany({
          where: { lineItemCode: dup.code, statementType },
          data: { lineItemCode: canonical.code },
        });

        await tx.lineItem.delete({ where: { code: dup.code } });
      }
    }
    });
  } catch (e) {
    if (conflicts.length) {
      console.error("\nConflicts detected; transaction rolled back. No changes were applied.");
      console.error(JSON.stringify(conflicts.slice(0, 50), null, 2));
      process.exitCode = 2;
      return;
    }
    throw e;
  }

  console.log("\nCleanup complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

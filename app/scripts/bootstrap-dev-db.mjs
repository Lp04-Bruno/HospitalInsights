import { execSync } from "node:child_process";

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

if (process.env.SKIP_DB_BOOTSTRAP === "true") {
  process.exit(0);
}

let PrismaClient;
try {
  ({ PrismaClient } = await import("@prisma/client"));
} catch {
  process.exit(0);
}

try {
  const prisma = new PrismaClient();
  let ready = false;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      ready = true;
      break;
    } catch {
      await sleep(1000);
    }
  }

  if (!ready) {
    await prisma.$disconnect();
    process.exit(0);
  }

  await prisma.$disconnect();
} catch {
  process.exit(0);
}

try {
  run("npx prisma migrate deploy");
} catch {
  process.exit(0);
}

const prisma = new PrismaClient();
try {
  const marker = await prisma.lineItem.findFirst({
    where: { code: "BAL_P__TOTAL" },
    select: { code: true },
  });

  if (!marker) {
    console.log("[bootstrap] Detected legacy LineItems -> reseeding from statement catalog");
    run("npx prisma db seed");
  }

  await prisma.lineItem.deleteMany({
    where: {
      code: {
        in: ["BAL_P__TOTAL__D__D_KH", "BAL_P__TOTAL__D__D_KH__D_KH_BP", "BAL_P__TOTAL__D__D_KH__D_KH_DAVON"],
      },
    },
  });

  try {
    const migrations = [
      { from: "UKV__EMPLOYEES", to: "OTH__EMPLOYEES" },
      { from: "UKV__STEUERN__STEUERN_RATE", to: "OTH__LATENT_RATE" },
    ];

    for (const m of migrations) {
      const rows = await prisma.factValue.findMany({
        where: { lineItemCode: m.from },
        select: { hospitalId: true, periodId: true, value: true },
      });

      for (const r of rows) {
        const exists = await prisma.factValue.findUnique({
          where: {
            hospitalId_periodId_lineItemCode: {
              hospitalId: r.hospitalId,
              periodId: r.periodId,
              lineItemCode: m.to,
            },
          },
          select: { id: true },
        });

        if (!exists) {
          await prisma.factValue.create({
            data: {
              hospitalId: r.hospitalId,
              periodId: r.periodId,
              lineItemCode: m.to,
              value: r.value,
            },
          });
        }
      }

      await prisma.factValue.deleteMany({ where: { lineItemCode: m.from } });
    }

    await prisma.lineItem.deleteMany({
      where: { code: { in: ["UKV__EMPLOYEES", "UKV__STEUERN__STEUERN_RATE"] } },
    });
  } catch {
    // keep dev startup resilient
  }

  try {
    run("npx ts-node --transpile-only -P prisma/tsconfig.seed.json scripts/sync-lineitems-from-catalog.ts");
  } catch {
    // keep dev startup resilient
  }
} catch {
  // keep dev startup resilient.
} finally {
  try {
    await prisma.$disconnect();
  } catch {
    // ignore
  }
}

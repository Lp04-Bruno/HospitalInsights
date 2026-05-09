import "dotenv/config";
import { execSync } from "node:child_process";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../prisma/generated/client";

config({ path: "../infra/.env", quiet: true });

function run(cmd: string) {
  execSync(cmd, { stdio: "inherit" });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function createPrisma() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
}

if (process.env.SKIP_DB_BOOTSTRAP === "true") {
  process.exit(0);
}

try {
  const prisma = createPrisma();
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

  await prisma.$disconnect();

  if (!ready) {
    process.exit(0);
  }
} catch {
  process.exit(0);
}

try {
  run("npx prisma migrate deploy");
} catch {
  process.exit(0);
}

const prisma = createPrisma();
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
    run("npx tsx scripts/sync-lineitems-from-catalog.ts");
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

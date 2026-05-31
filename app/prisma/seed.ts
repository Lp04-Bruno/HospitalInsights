import "dotenv/config";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";

import { getStatementCatalog } from "../lib/statementCatalog";
import { PrismaClient } from "./generated/client";
import { Role } from "./generated/enums";

config({ path: "../infra/.env", quiet: true });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function ensureCatalogLineItems(opts: { reset: boolean }) {
  const { lineItems } = getStatementCatalog();

  if (opts.reset) {
    await prisma.factChange.deleteMany({});
    await prisma.factChangeRun.deleteMany({});
    await prisma.factValue.deleteMany({});
    await prisma.lineItem.deleteMany({});
  }

  const existingCount = await prisma.lineItem.count();
  if (existingCount === 0) {
    await prisma.lineItem.createMany({ data: lineItems });
    console.log("Seeded catalog line items:", { lineItems: lineItems.length });
  } else {
    console.log("Catalog line items already present:", { lineItems: existingCount });
  }
}

async function main() {
  const isProd = process.env.NODE_ENV === "production";

  const seedAdminEmail = process.env.SEED_ADMIN_EMAIL ?? (isProd ? "" : "admin@hospitalinsights.local");
  const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD ?? (isProd ? "" : "admin1234");

  if (!isProd || (seedAdminEmail && seedAdminPassword)) {
    if (!seedAdminEmail || !seedAdminPassword) {
      throw new Error("Missing SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD for admin seeding");
    }

    const hash = await bcrypt.hash(seedAdminPassword, 12);
    await prisma.user.upsert({
      where: { email: seedAdminEmail },
      update: {
        name: "Admin",
        password: hash,
        role: Role.ADMIN,
      },
      create: {
        email: seedAdminEmail,
        name: "Admin",
        password: hash,
        role: Role.ADMIN,
      },
    });

    console.log("Seeded admin:", { email: seedAdminEmail });
    if (!isProd) {
      console.log("[dev] Seeded admin password is the default unless SEED_ADMIN_PASSWORD is set.");
    }
  } else {
    console.warn(
      "[seed] Skipping admin creation in production. Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD if you want to seed an admin user."
    );
  }

  await ensureCatalogLineItems({ reset: !isProd });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());

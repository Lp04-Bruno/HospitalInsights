import "dotenv/config";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../prisma/generated/client";

config({ path: "../infra/.env", quiet: true });

function databaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required to create a Prisma client");
  }
  return url;
}

export function createPrismaClient(options: Pick<Prisma.PrismaClientOptions, "log"> = {}) {
  const adapter = new PrismaPg({ connectionString: databaseUrl() });
  return new PrismaClient({ adapter, ...options });
}

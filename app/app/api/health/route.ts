import { prisma } from "@/lib/prisma";

export async function GET() {
  const timeoutMs = 2000;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("DB healthcheck timeout")), timeoutMs)),
    ]);

    return Response.json({ status: "ok", db: "ok" }, { status: 200 });
  } catch (e) {
    return Response.json({ status: "error", db: "error", message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

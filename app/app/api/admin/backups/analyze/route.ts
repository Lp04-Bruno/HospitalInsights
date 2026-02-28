import { getServerAuthSession } from "@/lib/auth";
import { analyzeBackup } from "@/lib/dbBackups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return new Response("Forbidden", { status: 403 });
  }

  const u = new URL(req.url);
  const filename = String(u.searchParams.get("file") ?? "").trim();
  if (!filename) return new Response("Missing file", { status: 400 });

  try {
    const analysis = await analyzeBackup(filename);
    return Response.json(analysis, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Analyze failed";
    return new Response(msg, { status: 500 });
  }
}

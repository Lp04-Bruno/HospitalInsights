import { Readable } from "node:stream";
import { stat } from "node:fs/promises";

import { getServerAuthSession } from "@/lib/auth";
import { createBackupReadStream, resolveBackupPath } from "@/lib/dbBackups";

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

  const downloadName = filename.replace(/[\\/]/g, "_");

  const filePath = resolveBackupPath(filename);

  try {
    await stat(filePath);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const nodeStream = createBackupReadStream(filename);
  const body = Readable.toWeb(nodeStream);

  return new Response(body as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename=\"${downloadName}\"`,
      "Cache-Control": "no-store",
    },
  });
}

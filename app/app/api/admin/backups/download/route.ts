import { Readable } from "node:stream";
import { stat } from "node:fs/promises";

import { requireApiAdmin } from "@/lib/access";
import { createBackupReadStream, resolveBackupPath } from "@/lib/dbBackups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const access = await requireApiAdmin();
  if (!access.ok) return access.response;

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

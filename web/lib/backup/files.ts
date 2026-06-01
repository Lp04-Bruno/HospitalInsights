import { createReadStream } from "node:fs";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import type { BackupInfo, BackupKind } from "@/lib/backup/types";

export function getBackupDir(): string {
  return process.env.BACKUP_DIR ? path.resolve(process.env.BACKUP_DIR) : path.resolve(process.cwd(), "backups");
}

export async function ensureBackupDir() {
  await mkdir(getBackupDir(), { recursive: true });
}

export function todayKey() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function backupKindFromFilename(filename: string): BackupKind {
  if (filename.includes("data_export_")) return "data";
  if (filename.includes("_daily_")) return "daily";
  if (filename.includes("_manual_")) return "manual";
  if (filename.includes("_upload_")) return "upload";
  return "unknown";
}

export function safeFilename(input: string): string {
  const cleaned = input.replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.basename(cleaned);
}

export async function listBackupFiles(): Promise<BackupInfo[]> {
  await ensureBackupDir();

  const entries = await readdir(getBackupDir());
  const files = entries.filter((f) => f.endsWith(".dump"));

  const infos = await Promise.all(
    files.map(async (filename) => {
      const st = await stat(path.join(getBackupDir(), filename));
      return {
        filename,
        kind: backupKindFromFilename(filename),
        sizeBytes: st.size,
        createdAt: st.mtime,
      } satisfies BackupInfo;
    })
  );

  infos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return infos;
}

export async function writeUploadedBackup(file: File): Promise<string> {
  await ensureBackupDir();

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const original = safeFilename(file.name || "upload");
  const base = original.replace(/\.dump$/i, "");
  const filename = safeFilename(`backup_upload_${ts}_${base}.dump`);
  const outPath = path.join(getBackupDir(), filename);

  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(outPath, buf);
  return filename;
}

export function createBackupReadStream(filename: string) {
  return createReadStream(resolveBackupPath(filename));
}

export function resolveBackupPath(filename: string) {
  return path.join(getBackupDir(), safeFilename(filename));
}

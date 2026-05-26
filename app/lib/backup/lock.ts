import { open, stat, unlink } from "node:fs/promises";
import path from "node:path";

import { ensureBackupDir, getBackupDir } from "@/lib/backup/files";

const BACKUP_LOCK_RETRY_MS = 250;
const BACKUP_LOCK_TIMEOUT_MS = 30_000;
const BACKUP_LOCK_STALE_MS = 10 * 60 * 1000;

export async function withBackupLock<T>(fn: () => Promise<T>): Promise<T> {
  await ensureBackupDir();
  const lockPath = path.join(getBackupDir(), ".lock");
  const startedAt = Date.now();
  let lockHandle: Awaited<ReturnType<typeof open>> | null = null;

  while (!lockHandle) {
    try {
      lockHandle = await open(lockPath, "wx");
      await lockHandle.writeFile(
        JSON.stringify({
          pid: process.pid,
          createdAt: new Date().toISOString(),
        })
      );
      break;
    } catch (err) {
      const anyErr = err as NodeJS.ErrnoException;
      if (anyErr.code !== "EEXIST") throw err;

      try {
        const existing = await stat(lockPath);
        const ageMs = Date.now() - existing.mtimeMs;
        if (ageMs >= BACKUP_LOCK_STALE_MS) {
          await unlink(lockPath).catch(() => {
            // Another process may have released the stale lock first.
          });
          continue;
        }
      } catch (statErr) {
        const anyStatErr = statErr as NodeJS.ErrnoException;
        if (anyStatErr.code === "ENOENT") continue;
        throw statErr;
      }

      if (Date.now() - startedAt >= BACKUP_LOCK_TIMEOUT_MS) {
        throw new Error("Backup operation is busy. Another backup or restore is still running.", { cause: err });
      }

      await new Promise((resolve) => setTimeout(resolve, BACKUP_LOCK_RETRY_MS));
    }
  }

  try {
    return await fn();
  } finally {
    try {
      await lockHandle?.close();
    } catch {
      // ignore
    }
    try {
      await unlink(lockPath);
    } catch {
      // ignore
    }
  }
}

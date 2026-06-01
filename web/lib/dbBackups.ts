import { stat, unlink } from "node:fs/promises";

import {
  backupKindFromFilename,
  createBackupReadStream,
  ensureBackupDir,
  listBackupFiles,
  resolveBackupPath,
  safeFilename,
  todayKey,
  writeUploadedBackup,
} from "@/lib/backup/files";
import { withBackupLock } from "@/lib/backup/lock";
import {
  createPgBackup,
  createPgDataExport,
  readPgRestoreList,
  runPgRestore,
  runPsqlSql,
  terminateOtherDbConnections,
} from "@/lib/backup/postgres";
import type { BackupAnalysis, BackupInfo, BackupKind, RestoreMode } from "@/lib/backup/types";
import { parseEnvBoolean } from "@/lib/validation";

export type { BackupAnalysis, BackupInfo, BackupKind, RestoreMode };
export { createBackupReadStream, resolveBackupPath, safeFilename };

export function backupsFeatureEnabled() {
  return parseEnvBoolean(process.env.BACKUP_ENABLED, process.env.NODE_ENV !== "production");
}

export function backupsRestoreEnabled() {
  return parseEnvBoolean(process.env.BACKUP_RESTORE_ENABLED, process.env.NODE_ENV !== "production");
}

export function backupsAutoDailyEnabled() {
  return parseEnvBoolean(process.env.BACKUP_AUTO_DAILY, false);
}

export function backupsAutoOnHealthEnabled() {
  return parseEnvBoolean(process.env.BACKUP_AUTO_ON_HEALTH, false);
}

export async function listBackups(): Promise<BackupInfo[]> {
  return listBackupFiles();
}

export async function createBackup(kind: Exclude<BackupKind, "unknown">): Promise<string> {
  if (!backupsFeatureEnabled()) throw new Error("Backups are disabled.");

  return withBackupLock(() => createPgBackup(kind));
}

export async function createDataExport(): Promise<string> {
  if (!backupsFeatureEnabled()) throw new Error("Backups are disabled.");

  return withBackupLock(createPgDataExport);
}

export async function ensureDailyBackup(): Promise<{ created: boolean; filename?: string }> {
  if (!backupsFeatureEnabled() || !backupsAutoDailyEnabled()) return { created: false };

  await ensureBackupDir();
  const filename = `backup_daily_${todayKey()}.dump`;

  try {
    await stat(resolveBackupPath(filename));
    return { created: false, filename };
  } catch {
    const createdFilename = await createBackup("daily");
    return { created: true, filename: createdFilename };
  }
}

export async function deleteBackup(filename: string): Promise<void> {
  if (!backupsFeatureEnabled()) throw new Error("Backups are disabled.");

  await withBackupLock(async () => {
    await unlink(resolveBackupPath(filename));
  });
}

export async function analyzeBackup(filename: string): Promise<BackupAnalysis> {
  const safe = safeFilename(filename);
  const dumpPath = resolveBackupPath(safe);
  await stat(dumpPath);

  const kind = backupKindFromFilename(safe);

  try {
    const { stdout } = await readPgRestoreList(dumpPath);

    const tableData: Array<{ schema: string; table: string }> = [];
    let hasSchema = false;
    let hasData = false;

    const lines = stdout.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith(";")) continue;

      const idx = line.indexOf(";");
      const rest = idx >= 0 ? line.slice(idx + 1).trim() : line;

      if (rest.includes("TABLE DATA")) {
        hasData = true;
        const m = rest.match(/TABLE DATA\s+(\S+)\s+(.+)$/);
        if (m) {
          const schema = m[1];
          const table = m[2].trim();
          tableData.push({ schema, table });
        }
        continue;
      }

      if (
        rest.includes("TABLE ") ||
        rest.includes("SCHEMA") ||
        rest.includes("TYPE ") ||
        rest.includes("FUNCTION") ||
        rest.includes("SEQUENCE")
      ) {
        hasSchema = true;
      }
    }

    return {
      filename: safe,
      kind,
      format: "custom",
      hasSchema,
      hasData,
      tableData,
    };
  } catch {
    return {
      filename: safe,
      kind,
      format: "unknown",
      hasSchema: false,
      hasData: false,
      tableData: [],
    };
  }
}

export async function importBackup(filename: string, mode: RestoreMode): Promise<void> {
  if (!backupsFeatureEnabled()) throw new Error("Backups are disabled.");
  if (!backupsRestoreEnabled()) throw new Error("Restore is disabled.");

  const safe = safeFilename(filename);
  const dumpPath = resolveBackupPath(safe);
  const kind = backupKindFromFilename(safe);

  return withBackupLock(async () => {
    await stat(dumpPath);

    const shouldTerminateConnections = mode === "replace" && kind !== "data";
    if (shouldTerminateConnections) {
      await terminateOtherDbConnections();
    }

    if (mode === "replace") {
      if (kind === "data") {
        await runPsqlSql('TRUNCATE TABLE public."Hospital", public."Period" CASCADE');
        await runPgRestore(["--data-only", "--no-owner", "--no-privileges", "--single-transaction", dumpPath]);
        return;
      }

      await runPgRestore(["--clean", "--if-exists", "--no-owner", "--no-privileges", "--single-transaction", dumpPath]);
      return;
    }

    await runPgRestore(["--data-only", "--no-owner", "--no-privileges", "--single-transaction", dumpPath]);
  });
}

export async function uploadBackup(file: File): Promise<string> {
  if (!backupsFeatureEnabled()) throw new Error("Backups are disabled.");

  return withBackupLock(() => writeUploadedBackup(file));
}

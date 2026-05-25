import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, open, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export type BackupKind = "daily" | "manual" | "upload" | "data" | "unknown";

export type RestoreMode = "replace" | "append";

export type BackupAnalysis = {
  filename: string;
  kind: BackupKind;
  format: "custom" | "unknown";
  hasSchema: boolean;
  hasData: boolean;
  tableData: Array<{ schema: string; table: string }>;
};

export type BackupInfo = {
  filename: string;
  kind: BackupKind;
  sizeBytes: number;
  createdAt: Date;
};

const BACKUP_LOCK_RETRY_MS = 250;
const BACKUP_LOCK_TIMEOUT_MS = 30_000;
const BACKUP_LOCK_STALE_MS = 10 * 60 * 1000;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function parseDatabaseUrl(databaseUrl: string) {
  const u = new URL(databaseUrl);

  const user = decodeURIComponent(u.username || "");
  const password = decodeURIComponent(u.password || "");
  const host = u.hostname;
  const port = u.port ? Number(u.port) : 5432;
  const dbName = u.pathname.replace(/^\//, "");

  if (!host || !dbName || !user) {
    throw new Error("Invalid DATABASE_URL (host/db/user required)");
  }

  return { user, password, host, port, dbName };
}

function getBackupDir(): string {
  return process.env.BACKUP_DIR ? path.resolve(process.env.BACKUP_DIR) : path.resolve(process.cwd(), "backups");
}

export function backupsFeatureEnabled() {
  const raw = process.env.BACKUP_ENABLED;
  if (raw === undefined) return process.env.NODE_ENV !== "production";
  return raw === "1" || raw.toLowerCase() === "true";
}

export function backupsRestoreEnabled() {
  const raw = process.env.BACKUP_RESTORE_ENABLED;
  if (raw === undefined) return process.env.NODE_ENV !== "production";
  return raw === "1" || raw.toLowerCase() === "true";
}

export function backupsAutoDailyEnabled() {
  const raw = process.env.BACKUP_AUTO_DAILY;
  if (raw === undefined) return false;
  return raw === "1" || raw.toLowerCase() === "true";
}

export function backupsAutoOnHealthEnabled() {
  const raw = process.env.BACKUP_AUTO_ON_HEALTH;
  if (raw === undefined) return false;
  return raw === "1" || raw.toLowerCase() === "true";
}

async function ensureBackupDir() {
  await mkdir(getBackupDir(), { recursive: true });
}

function todayKey() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function backupKindFromFilename(filename: string): BackupKind {
  if (filename.includes("data_export_")) return "data";
  if (filename.includes("_daily_")) return "daily";
  if (filename.includes("_manual_")) return "manual";
  if (filename.includes("_upload_")) return "upload";
  return "unknown";
}

function safeFilename(input: string): string {
  const cleaned = input.replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.basename(cleaned);
}

function run(cmd: string, args: string[], env: Record<string, string | undefined>) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += String(d);
      if (stderr.length > 16_000) stderr = stderr.slice(-16_000);
    });

    child.on("error", (err) => {
      const anyErr = err as unknown as { code?: string; message?: string };
      if (anyErr?.code === "ENOENT") {
        reject(
          new Error(
            `${cmd} not found (ENOENT). Install PostgreSQL client tools in the runtime image (pg_dump/pg_restore/psql). In dev via docker-compose, rebuild the app image.`
          )
        );
        return;
      }
      reject(err);
    });
    child.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${cmd} exited with ${code}: ${stderr.trim() || "(no stderr)"}`));
    });
  });
}

function runCapture(cmd: string, args: string[], env: Record<string, string | undefined>) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(cmd, args, {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => {
      stdout += String(d);
      if (stdout.length > 200_000) stdout = stdout.slice(-200_000);
    });

    child.stderr.on("data", (d) => {
      stderr += String(d);
      if (stderr.length > 16_000) stderr = stderr.slice(-16_000);
    });

    child.on("error", (err) => {
      const anyErr = err as unknown as { code?: string; message?: string };
      if (anyErr?.code === "ENOENT") {
        reject(
          new Error(
            `${cmd} not found (ENOENT). Install PostgreSQL client tools in the runtime image (pg_dump/pg_restore/psql). In dev via docker-compose, rebuild the app image.`
          )
        );
        return;
      }
      reject(err);
    });

    child.on("close", (code) => {
      if (code === 0) return resolve({ stdout, stderr });
      reject(new Error(`${cmd} exited with ${code}: ${stderr.trim() || "(no stderr)"}`));
    });
  });
}

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
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

export async function listBackups(): Promise<BackupInfo[]> {
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

export async function createBackup(kind: Exclude<BackupKind, "unknown">): Promise<string> {
  if (!backupsFeatureEnabled()) throw new Error("Backups are disabled.");

  return withLock(async () => {
    await ensureBackupDir();

    const dbUrl = requireEnv("DATABASE_URL");
    const { user, password, host, port, dbName } = parseDatabaseUrl(dbUrl);

    const now = new Date();
    const ts = now.toISOString().replace(/[:.]/g, "-");
    const daily = todayKey();

    const filename = kind === "daily" ? `backup_daily_${daily}.dump` : `backup_${kind}_${ts}.dump`;

    const outPath = path.join(getBackupDir(), filename);
    const tmpPath = path.join(getBackupDir(), `${filename}.tmp`);

    await run(
      "pg_dump",
      ["-h", host, "-p", String(port), "-U", user, "-d", dbName, "-Fc", "--no-owner", "--no-privileges", "-f", tmpPath],
      { PGPASSWORD: password }
    );

    await rename(tmpPath, outPath);
    return filename;
  });
}

export async function createDataExport(): Promise<string> {
  if (!backupsFeatureEnabled()) throw new Error("Backups are disabled.");

  return withLock(async () => {
    await ensureBackupDir();

    const dbUrl = requireEnv("DATABASE_URL");
    const { user, password, host, port, dbName } = parseDatabaseUrl(dbUrl);

    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `data_export_${ts}.dump`;

    const outPath = path.join(getBackupDir(), filename);
    const tmpPath = path.join(getBackupDir(), `${filename}.tmp`);

    const tables = ['public."Hospital"', 'public."Period"', 'public."HospitalPeriod"', 'public."FactValue"'];

    const args = [
      "-h",
      host,
      "-p",
      String(port),
      "-U",
      user,
      "-d",
      dbName,
      "-Fc",
      "--data-only",
      "--no-owner",
      "--no-privileges",
      ...tables.flatMap((t) => ["--table", t]),
      "-f",
      tmpPath,
    ];

    await run("pg_dump", args, { PGPASSWORD: password });

    await rename(tmpPath, outPath);
    return filename;
  });
}

export async function ensureDailyBackup(): Promise<{ created: boolean; filename?: string }> {
  if (!backupsFeatureEnabled() || !backupsAutoDailyEnabled()) return { created: false };

  await ensureBackupDir();
  const daily = todayKey();
  const filename = `backup_daily_${daily}.dump`;
  const full = path.join(getBackupDir(), filename);

  try {
    await stat(full);
    return { created: false, filename };
  } catch {
    const createdFilename = await createBackup("daily");
    return { created: true, filename: createdFilename };
  }
}

export async function deleteBackup(filename: string): Promise<void> {
  if (!backupsFeatureEnabled()) throw new Error("Backups are disabled.");

  const safe = safeFilename(filename);
  const full = path.join(getBackupDir(), safe);

  await withLock(async () => {
    await unlink(full);
  });
}

async function terminateOtherDbConnections() {
  const dbUrl = requireEnv("DATABASE_URL");
  const { user, password, host, port, dbName } = parseDatabaseUrl(dbUrl);
  await run(
    "psql",
    [
      "-h",
      host,
      "-p",
      String(port),
      "-U",
      user,
      "-d",
      dbName,
      "-c",
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid();",
    ],
    { PGPASSWORD: password }
  );
}

async function runPgRestore(args: string[]) {
  const dbUrl = requireEnv("DATABASE_URL");
  const { user, password, host, port, dbName } = parseDatabaseUrl(dbUrl);

  await run("pg_restore", ["-h", host, "-p", String(port), "-U", user, "-d", dbName, ...args], { PGPASSWORD: password });
}

async function runPsqlSql(sql: string) {
  const dbUrl = requireEnv("DATABASE_URL");
  const { user, password, host, port, dbName } = parseDatabaseUrl(dbUrl);
  await run("psql", ["-h", host, "-p", String(port), "-U", user, "-d", dbName, "-v", "ON_ERROR_STOP=1", "-c", sql], {
    PGPASSWORD: password,
  });
}

export async function analyzeBackup(filename: string): Promise<BackupAnalysis> {
  const safe = safeFilename(filename);
  const dumpPath = path.join(getBackupDir(), safe);
  await stat(dumpPath);

  const kind = backupKindFromFilename(safe);

  try {
    const { stdout } = await runCapture("pg_restore", ["-l", dumpPath], {});

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

export async function restoreBackup(filename: string): Promise<void> {
  if (!backupsFeatureEnabled()) throw new Error("Backups are disabled.");
  if (!backupsRestoreEnabled()) throw new Error("Restore is disabled.");

  const safe = safeFilename(filename);
  const dumpPath = path.join(getBackupDir(), safe);

  return withLock(async () => {
    await stat(dumpPath);

    await terminateOtherDbConnections();

    await runPgRestore(["--clean", "--if-exists", "--no-owner", "--no-privileges", "--single-transaction", dumpPath]);
  });
}

export async function importBackup(filename: string, mode: RestoreMode): Promise<void> {
  if (!backupsFeatureEnabled()) throw new Error("Backups are disabled.");
  if (!backupsRestoreEnabled()) throw new Error("Restore is disabled.");

  const safe = safeFilename(filename);
  const dumpPath = path.join(getBackupDir(), safe);
  const kind = backupKindFromFilename(safe);

  return withLock(async () => {
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

  return withLock(async () => {
    await ensureBackupDir();

    const ts = new Date().toISOString().replace(/[:.]/g, "-");

    const original = safeFilename(file.name || "upload");
    const base = original.replace(/\.dump$/i, "");
    const filename = safeFilename(`backup_upload_${ts}_${base}.dump`);
    const outPath = path.join(getBackupDir(), filename);

    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(outPath, buf);
    return filename;
  });
}

export function createBackupReadStream(filename: string) {
  const safe = safeFilename(filename);
  const full = path.join(getBackupDir(), safe);
  return createReadStream(full);
}

export function resolveBackupPath(filename: string) {
  const safe = safeFilename(filename);
  return path.join(getBackupDir(), safe);
}

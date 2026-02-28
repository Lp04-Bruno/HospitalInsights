import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export type BackupKind = "daily" | "manual" | "upload" | "unknown";

export type BackupInfo = {
  filename: string;
  kind: BackupKind;
  sizeBytes: number;
  createdAt: Date;
};

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
  if (filename.includes("_daily_")) return "daily";
  if (filename.includes("_manual_")) return "manual";
  if (filename.includes("_upload_")) return "upload";
  return "unknown";
}

function safeFilename(input: string): string {
  const cleaned = input.replace(/[^a-zA-Z0-9._\-]/g, "_");
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

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  await ensureBackupDir();
  const lockPath = path.join(getBackupDir(), ".lock");

  await writeFile(lockPath, String(Date.now()));
  try {
    return await fn();
  } finally {
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

export async function restoreBackup(filename: string): Promise<void> {
  if (!backupsFeatureEnabled()) throw new Error("Backups are disabled.");
  if (!backupsRestoreEnabled()) throw new Error("Restore is disabled.");

  const safe = safeFilename(filename);
  const dumpPath = path.join(getBackupDir(), safe);

  return withLock(async () => {
    await stat(dumpPath);

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

    await run(
      "pg_restore",
      [
        "-h",
        host,
        "-p",
        String(port),
        "-U",
        user,
        "-d",
        dbName,
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-privileges",
        "--single-transaction",
        dumpPath,
      ],
      { PGPASSWORD: password }
    );
  });
}

export async function uploadBackup(file: File): Promise<string> {
  if (!backupsFeatureEnabled()) throw new Error("Backups are disabled.");

  return withLock(async () => {
    await ensureBackupDir();

    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = safeFilename(`backup_upload_${ts}_${file.name || "upload"}.dump`);
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

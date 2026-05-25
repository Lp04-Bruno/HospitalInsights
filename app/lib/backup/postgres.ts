import { rename } from "node:fs/promises";
import path from "node:path";

import { ensureBackupDir, getBackupDir, todayKey } from "@/lib/backup/files";
import { run, runCapture } from "@/lib/backup/process";
import type { BackupKind } from "@/lib/backup/types";

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

function getDatabaseConnection() {
  return parseDatabaseUrl(requireEnv("DATABASE_URL"));
}

function timestampKey() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export async function createPgBackup(kind: Exclude<BackupKind, "unknown">): Promise<string> {
  await ensureBackupDir();

  const { user, password, host, port, dbName } = getDatabaseConnection();
  const filename = kind === "daily" ? `backup_daily_${todayKey()}.dump` : `backup_${kind}_${timestampKey()}.dump`;
  const outPath = path.join(getBackupDir(), filename);
  const tmpPath = path.join(getBackupDir(), `${filename}.tmp`);

  await run("pg_dump", ["-h", host, "-p", String(port), "-U", user, "-d", dbName, "-Fc", "--no-owner", "--no-privileges", "-f", tmpPath], {
    PGPASSWORD: password,
  });

  await rename(tmpPath, outPath);
  return filename;
}

export async function createPgDataExport(): Promise<string> {
  await ensureBackupDir();

  const { user, password, host, port, dbName } = getDatabaseConnection();
  const filename = `data_export_${timestampKey()}.dump`;
  const outPath = path.join(getBackupDir(), filename);
  const tmpPath = path.join(getBackupDir(), `${filename}.tmp`);
  const tables = ['public."Hospital"', 'public."Period"', 'public."HospitalPeriod"', 'public."FactValue"'];

  await run(
    "pg_dump",
    [
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
    ],
    { PGPASSWORD: password }
  );

  await rename(tmpPath, outPath);
  return filename;
}

export async function terminateOtherDbConnections() {
  const { user, password, host, port, dbName } = getDatabaseConnection();
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

export async function runPgRestore(args: string[]) {
  const { user, password, host, port, dbName } = getDatabaseConnection();
  await run("pg_restore", ["-h", host, "-p", String(port), "-U", user, "-d", dbName, ...args], { PGPASSWORD: password });
}

export async function runPsqlSql(sql: string) {
  const { user, password, host, port, dbName } = getDatabaseConnection();
  await run("psql", ["-h", host, "-p", String(port), "-U", user, "-d", dbName, "-v", "ON_ERROR_STOP=1", "-c", sql], {
    PGPASSWORD: password,
  });
}

export async function readPgRestoreList(dumpPath: string) {
  return runCapture("pg_restore", ["-l", dumpPath], {});
}

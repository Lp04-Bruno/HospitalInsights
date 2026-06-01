import { spawn } from "node:child_process";

function pgToolMissingError(cmd: string): Error {
  return new Error(
    `${cmd} not found (ENOENT). Install PostgreSQL client tools in the runtime image (pg_dump/pg_restore/psql). In dev via docker-compose, rebuild the app image.`
  );
}

export function run(cmd: string, args: string[], env: Record<string, string | undefined>) {
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
      const anyErr = err as unknown as { code?: string };
      reject(anyErr?.code === "ENOENT" ? pgToolMissingError(cmd) : err);
    });

    child.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${cmd} exited with ${code}: ${stderr.trim() || "(no stderr)"}`));
    });
  });
}

export function runCapture(cmd: string, args: string[], env: Record<string, string | undefined>) {
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
      const anyErr = err as unknown as { code?: string };
      reject(anyErr?.code === "ENOENT" ? pgToolMissingError(cmd) : err);
    });

    child.on("close", (code) => {
      if (code === 0) return resolve({ stdout, stderr });
      reject(new Error(`${cmd} exited with ${code}: ${stderr.trim() || "(no stderr)"}`));
    });
  });
}

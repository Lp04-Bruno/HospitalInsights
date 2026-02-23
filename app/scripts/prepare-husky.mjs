import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function main() {
  const repoRoot = path.resolve(process.cwd(), "..");
  const gitDir = path.join(repoRoot, ".git");

  if (!(await exists(gitDir))) {
    console.log("[prepare] .git not found; skipping husky install.");
    return;
  }

  await run("git", ["config", "core.hooksPath", ".husky"], repoRoot);
}

main().catch((e) => {
  console.error("[prepare] Failed:", e);
  process.exit(1);
});

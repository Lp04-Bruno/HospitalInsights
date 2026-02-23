import { spawnSync } from "node:child_process";

function execGit(args) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function execNpm(args, cwd) {
  const result = spawnSync("npm", args, {
    cwd,
    shell: process.platform === "win32",
    stdio: "inherit",
  });
  return result.status ?? 1;
}

function splitNullSeparated(s) {
  const trimmed = s.endsWith("\u0000") ? s.slice(0, -1) : s;
  return trimmed ? trimmed.split("\u0000").filter(Boolean) : [];
}

function isPrettierCandidate(file) {
  return !file.endsWith("/");
}

function isEslintCandidate(file) {
  return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file);
}

function main() {
  const repoRoot = execGit(["rev-parse", "--show-toplevel"]).trim();

  const staged = splitNullSeparated(execGit(["diff", "--cached", "--name-only", "--diff-filter=ACM", "-z"]));

  const stagedTargets = staged.filter((f) => !f.endsWith("/"));

  const prettierFiles = stagedTargets.filter(isPrettierCandidate);
  const eslintFiles = staged
    .filter(isEslintCandidate)
    .filter((f) => f.startsWith("app/"))
    .map((f) => f.slice("app/".length));

  if (prettierFiles.length === 0 && eslintFiles.length === 0) {
    process.exit(0);
  }

  if (prettierFiles.length > 0) {
    const code = execNpm(["--prefix", "app", "exec", "--", "prettier", "--write", "--ignore-unknown", ...prettierFiles], repoRoot);
    if (code !== 0) process.exit(code);
  }

  if (eslintFiles.length > 0) {
    const code = execNpm(["exec", "--", "eslint", "--fix", "--no-warn-ignored", ...eslintFiles], `${repoRoot}/app`);
    if (code !== 0) process.exit(code);
  }

  const changedTargets = execGit(["diff", "--name-only", "--", ...stagedTargets]).trim();
  if (changedTargets) {
    console.error("\n[pre-commit] Formatting/lint fixes were applied.");
    console.error("[pre-commit] Review the changes, stage them, then commit again.");
    console.error("\nChanged files:\n" + changedTargets + "\n");
    process.exit(1);
  }

  process.exit(0);
}

main();

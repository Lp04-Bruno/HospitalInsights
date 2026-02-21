import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

async function exists(p) {
    try {
        await fs.access(p);
        return true;
    } catch {
        return false;
    }
}

function run(cmd, args) {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, {
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
    // In Dockerfile.dev we install deps before copying the full repo.
    // That means prisma/schema.prisma may not exist during `npm ci`.
    // We must NOT fail the build in that scenario.

    const schemaCandidates = [
        path.join(process.cwd(), "prisma", "schema.prisma"),
        path.join(process.cwd(), "schema.prisma"),
    ];

    const schemaPath = (await Promise.all(schemaCandidates.map(async (p) => ((await exists(p)) ? p : null))))
        .find(Boolean);

    if (!schemaPath) {
        console.log(
            "[postinstall] Prisma schema not found yet (expected during Docker build layer). Skipping prisma generate."
        );
        return;
    }

    await run("npx", ["prisma", "generate", "--schema", schemaPath]);

    // Windows-only safety
    if (process.platform === "win32") {
        await run("node", ["scripts/fix-prisma-client-windows.mjs"]);
    }
}

main().catch((e) => {
    console.error("[postinstall] Failed:", e);
    process.exit(1);
});

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

async function copyDir(src, dest) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
        const from = path.join(src, entry.name);
        const to = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            await copyDir(from, to);
        } else if (entry.isFile()) {
            await fs.copyFile(from, to);
        }
    }
}

async function main() {
    // Prisma often creates generated artifacts at node_modules/.prisma/client.
    // On some Windows setups symlink creation can fail, leaving @prisma/client/.prisma missing.
    // This script copies the generated artifacts into @prisma/client/.prisma/client as a fallback.

    const projectRoot = process.cwd();
    const source = path.join(projectRoot, "node_modules", ".prisma", "client");
    const target = path.join(
        projectRoot,
        "node_modules",
        "@prisma",
        "client",
        ".prisma",
        "client"
    );

    if (!(await exists(source))) {
        console.warn(
            "[fix-prisma-client] Source not found:",
            source,
            "(run `npx prisma generate` first)"
        );
        return;
    }

    if (await exists(target)) return;

    await copyDir(source, target);
    console.log("[fix-prisma-client] Copied generated client to:", target);
}

main().catch((e) => {
    console.error("[fix-prisma-client] Failed:", e);
    process.exit(1);
});

import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { resolveBackupPath, safeFilename } from "@/lib/dbBackups";

describe("backup filename safety", () => {
  it("keeps normal dump filenames unchanged", () => {
    expect(safeFilename("backup_manual_2026-05-25.dump")).toBe("backup_manual_2026-05-25.dump");
  });

  it("neutralizes path separators and shell-ish characters", () => {
    expect(safeFilename("../prod;drop.dump")).toBe(".._prod_drop.dump");
    expect(safeFilename("C:\\temp\\prod.dump")).toBe("C__temp_prod.dump");
  });

  it("resolves sanitized names inside BACKUP_DIR", () => {
    vi.stubEnv("BACKUP_DIR", path.resolve("tmp-backups"));

    expect(resolveBackupPath("../prod.dump")).toBe(path.join(path.resolve("tmp-backups"), ".._prod.dump"));
  });
});

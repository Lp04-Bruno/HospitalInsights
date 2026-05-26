import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": rootDir,
    },
  },
  test: {
    environment: "node",
    exclude: ["node_modules", ".next", "prisma/generated"],
    include: ["**/*.test.ts"],
    restoreMocks: true,
    unstubEnvs: true,
  },
});

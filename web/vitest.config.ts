import path from "node:path";
import { fileURLToPath } from "node:url";

import { configDefaults, defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": rootDir,
    },
  },
  test: {
    environment: "node",
    exclude: [...configDefaults.exclude, "**/.next/**", "**/prisma/generated/**"],
    include: ["**/*.test.ts"],
    restoreMocks: true,
    fsModuleCache: true,
    unstubEnvs: true,
  },
});

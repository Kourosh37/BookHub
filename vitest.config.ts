import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/{unit,components,integration}/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/env.ts", "./tests/setup.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      include: [
        "src/lib/**/*.ts",
        "src/services/**/*.ts",
        "src/shared/store/**/*.ts",
        "src/features/**/utils/*.{ts,tsx}",
      ],
      exclude: [
        "src/lib/prisma.ts",
        "src/lib/logger.ts",
        "src/lib/admin-audit.ts",
      ],
      thresholds: { lines: 95, statements: 90, functions: 90, branches: 85 },
    },
  },
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "istanbul",
      reporter: "lcov",
      exclude: ["**/dist"],
    },
    include: ["src/**/*.test.ts"],
  },
});

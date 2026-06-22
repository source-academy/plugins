import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "istanbul",
      reporter: "lcov",
      exclude: ["**/dist"],
    },
    environment: "jsdom",
    setupFiles: ["./vitest-setup.js"],
  },
});

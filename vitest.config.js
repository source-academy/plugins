import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    server: {
      deps: {
        inline: [/py-slang/],
      },
    },
    coverage: {
      provider: "istanbul",
      reporter: "lcov",
      exclude: ["**/dist"],
    },
  },
});

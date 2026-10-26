import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["scripts/**/*.test.mjs", "ui/**/*.test.js", "dev/**/*.test.js", "dev/**/*.test.mjs", "tests/**/*.test.js"],
  },
});

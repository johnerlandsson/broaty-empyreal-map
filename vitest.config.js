import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["scripts/**/*.test.mjs", "ui/**/*.test.js", "dev/**/*.test.js", "tests/**/*.test.js"],
  },
});

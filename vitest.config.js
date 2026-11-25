import { defineConfig } from "vitest/config";

export default defineConfig({
  // The game checks import TypeScript from ~/dev/empyreal, whose tsconfig says
  // target "es2024". Vite 5's esbuild (0.21) doesn't know that name and warns on
  // every run. Vite only uses tsconfig's target to pick the class-fields
  // default, which is the same for es2022 and es2024, so say es2022 here.
  esbuild: { tsconfigRaw: { compilerOptions: { target: "es2022" } } },
  test: {
    include: ["scripts/**/*.test.mjs", "ui/**/*.test.js", "dev/**/*.test.js", "dev/**/*.test.mjs", "tests/**/*.test.js"],
  },
});

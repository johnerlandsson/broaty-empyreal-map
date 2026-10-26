// @vitest-environment happy-dom
// What every place draws today, kept as golden files: a change to the map data or how it's built
// must leave these the same. GOLDEN_RECORD=1 writes the files from the current code instead.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import places from "../../ui/data/places.js";
import { renderPlace } from "./render.js";

// every place the generated index has: a new one fails till its golden is recorded
const IDS = places.map((p) => p.id);
const DIR = dirname(fileURLToPath(import.meta.url));
const RECORD = process.env.GOLDEN_RECORD === "1";

// pretty-printed, one string a line, so a diff shows which view changed
const text = (r) => `${JSON.stringify(r, null, 1)}\n`;

describe("golden renders", () => {
  for (const id of IDS) {
    it(`${id} draws as recorded`, async () => {
      const file = join(DIR, `${id}.txt`);
      const got = text(await renderPlace(id));
      if (RECORD) writeFileSync(file, got);
      else if (!existsSync(file)) throw new Error(`no golden for ${id}: record it with GOLDEN_RECORD=1 npx vitest run tests/golden`);
      else expect(got).toBe(readFileSync(file, "utf8"));
    });
  }
});

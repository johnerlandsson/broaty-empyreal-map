// @vitest-environment happy-dom
// What every place draws today, kept as golden files: a change to the map data or how it's built
// must leave these the same. GOLDEN_RECORD=1 writes the files from the current code instead.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderPlace } from "./render.js";

const IDS = ["tiss", "wenna", "zennor", "orrin", "morvah", "gwithian", "carrow", "lanyon", "kynance", "marazion", "penwith", "botallack", "polperro", "lamorna", "kilmar", "caradon", "garrow"];
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
      else expect(got).toBe(readFileSync(file, "utf8"));
    });
  }
});

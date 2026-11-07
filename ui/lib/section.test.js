// Dolcoath's section underground (pick C): the shaft diagram's layout, where the cage is and the
// words on hover. Pure.

import { describe, expect, it } from "vitest";
import dolcoath from "../../tests/fixtures/generated/dolcoath.js";
import { indexLevels } from "./levels.js";
import { levelsData, levelsSpec } from "./look.js";
import { ROW, cageAt, rowTip, sectionLayout } from "./section.js";

const index = indexLevels(levelsData(dolcoath), levelsSpec(dolcoath));
const layout = sectionLayout(index);
const row = (name) => layout.rows.find((r) => r.name === name);
const floors = index.cars[0].stops.map((id) => ({ id }));

describe("sectionLayout", () => {
  it("puts a row a level down the band, evenly spaced, top to bottom", () => {
    expect(layout.rows.map((r) => r.name)).toEqual(["THE PIT", "TWENTY FATHOM", "FORTY FATHOM", "THE TOWN", "THE SMELTS", "THE WORKINGS", "PUMP GALLERY", "THE BOTTOM OF THE WINZE"]);
    layout.rows.forEach((r, i) => expect(r.y).toBe(i * ROW));
    expect(layout.rows.map((r) => r.tag)).toEqual(["", "20 FM", "40 FM", "80 FM", "120 FM", "160 FM", "", "200 FM"]);
  });

  it("runs the cage's shaft and the man engine's from the Pit to the Workings", () => {
    expect(layout.cage).toEqual({ y0: 0, y1: row("THE WORKINGS").y });
    expect(layout.engine).toEqual({ y0: 0, y1: row("THE WORKINGS").y });
    for (const r of layout.rows.slice(0, 6)) expect(r).toMatchObject({ x: 0, from: null });
  });

  it("hangs the levels the cage doesn't stop at off the Workings, a column each", () => {
    const workings = row("THE WORKINGS").level;
    expect(row("PUMP GALLERY")).toMatchObject({ from: workings, stop: null });
    expect(row("THE BOTTOM OF THE WINZE")).toMatchObject({ from: workings, stop: null });
    expect(row("THE BOTTOM OF THE WINZE").x).toBeGreaterThan(row("PUMP GALLERY").x);
    expect(row("PUMP GALLERY").x).toBeGreaterThan(0);
  });

  it("has no shafts for a city with no cage and no man engine", () => {
    const bare = sectionLayout({ levels: [{ level: 0, name: "Top", depth: 0, stop: null, rooms: [] }], cars: [], byId: new Map() });
    expect(bare.cage).toBeNull();
    expect(bare.engine).toBeNull();
    expect(bare.rows).toHaveLength(1);
  });
});

describe("cageAt", () => {
  const cage = (lift) => cageAt(layout, index, { kind: "cage", floors, ...lift });

  it("puts the cage on its station, with no arrow", () => {
    expect(cage({ at: "dolcoath.town-station", heading: "down" })).toEqual({ y: row("THE TOWN").y, dir: 0, at: row("THE TOWN").level });
    expect(cage({ at: "dolcoath.pithead" })).toMatchObject({ y: 0 });
  });

  it("puts it midway between the two it's between, pointing the way it's going", () => {
    const mid = (row("THE TOWN").y + row("THE SMELTS").y) / 2;
    expect(cage({ between: ["dolcoath.town-station", "dolcoath.smelts-station"], heading: "down" })).toEqual({ y: mid, dir: 1, at: null });
    expect(cage({ between: ["dolcoath.smelts-station", "dolcoath.town-station"], heading: "up" })).toEqual({ y: mid, dir: -1, at: null });
    expect(cage({ between: ["dolcoath.town-station", "dolcoath.smelts-station"] }).dir).toBe(0);
  });

  it("puts nothing where the message isn't the cage's, or names a stop it hasn't", () => {
    expect(cageAt(layout, index, null)).toBeNull();
    expect(cageAt(layout, index, { kind: "tram", at: "dolcoath.pithead" })).toBeNull();
    expect(cage({ at: "dolcoath.nowhere" })).toBeNull();
    expect(cage({ between: ["dolcoath.pithead"] })).toBeNull();
    expect(cage({})).toBeNull();
  });
});

describe("rowTip", () => {
  it("says a level's name and how deep it is, or that it isn't known", () => {
    expect(rowTip(row("THE TOWN"))).toEqual({ title: "The Town", body: "80 fathoms down" });
    expect(rowTip(row("THE PIT"))).toEqual({ title: "The Pit", body: "At the surface" });
    expect(rowTip(row("PUMP GALLERY"))).toEqual({ title: "Pump Gallery", body: "Depth not known" });
  });
});

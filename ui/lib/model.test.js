import { describe, expect, it } from "vitest";
import station from "../data/station.js";
import { indexStation, keyOf, locate } from "./locate.js";
import { buildModel } from "./model.js";

const index = indexStation(station);
const faces = buildModel(index);

describe("buildModel", () => {
  it("has a corridor slice for every corridor stop", () => {
    for (const z of [0, 1, 2]) {
      for (const r of index.corridors[z]) {
        const key = `r${z}:${r.x}:0`;
        expect(faces.some((f) => f.key === key), key).toBe(true);
      }
    }
  });

  it("rim has 12 segments, mid and inner 8", () => {
    const count = (z) =>
      new Set(
        faces
          .filter((f) => f.kind === "fore" && f.key.startsWith(`r${z}:`))
          .map((f) => f.key.split(":")[1]),
      ).size;
    expect(count(0)).toBe(12);
    expect(count(1)).toBe(8);
    expect(count(2)).toBe(8);
  });

  it("the spine does not turn", () => {
    const sideIds = new Set(
      station.rooms.filter((r) => r.z === 3 && r.x !== 0 && r.y >= 2 && r.y <= 5).map((r) => r.id),
    );
    expect(sideIds.size).toBeGreaterThan(0);
    for (const f of faces) {
      const k = f.key ?? "";
      if (/^tiss\.spine-|^tiss\.blister$|^tiss\.bearing$/.test(k) || sideIds.has(k)) {
        expect(f.turns, k).toBe(false);
      }
      if (/^r\d:/.test(k) || k.startsWith("spoke:") || k === "tiss.hub" || k === "tiss.transfer") {
        expect(f.turns, k).toBe(true);
      }
    }
    for (const sid of sideIds) expect(faces.some((f) => f.key === sid)).toBe(true);
  });

  it("every face has well-formed fields", () => {
    for (const f of faces) {
      expect(f.pts.length).toBeGreaterThanOrEqual(3);
      expect(f.edges).toHaveLength(f.pts.length);
      expect(typeof f.turns).toBe("boolean");
      expect(typeof f.kind).toBe("string");
    }
  });

  it("spoke 3 points to 3 o'clock", () => {
    const pts = faces.filter((f) => f.key === "spoke:3:0").flatMap((f) => f.pts);
    expect(pts.length).toBeGreaterThan(0);
    const meanX = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    expect(meanX).toBeGreaterThan(0);
    const pts9 = faces.filter((f) => f.key === "spoke:9:0").flatMap((f) => f.pts);
    expect(pts9.reduce((s, p) => s + p[0], 0) / pts9.length).toBeLessThan(0);
  });

  it("every keyOf a station room has faces", () => {
    const keys = new Set(faces.map((f) => f.key));
    for (const room of station.rooms) {
      const key = keyOf(locate(index, { roomId: room.id }, null));
      if (key !== null) expect(keys.has(key), `${room.id} -> ${key}`).toBe(true);
    }
  });

  it("every spoke leg has faces", () => {
    const keys = new Set(faces.map((f) => f.key));
    for (const h of [0, 3, 6, 9]) for (const leg of [0, 1, 2]) expect(keys.has(`spoke:${h}:${leg}`)).toBe(true);
  });
});

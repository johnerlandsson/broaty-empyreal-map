import { describe, expect, it } from "vitest";
import tiss from "../data/tiss.js";
import { tissRooms } from "./look.js";
import { indexStation, keyOf, locate } from "./locate.js";
import { buildModel } from "./model.js";
import { RWZ } from "./geometry.js";

const station = tissRooms(tiss);
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

  it("each ring has a segment a stop, as its spacing in the source has them (rim 12, mid and inner 8 today)", () => {
    const count = (z) =>
      new Set(
        faces
          .filter((f) => f.kind === "fore" && f.key.startsWith(`r${z}:`))
          .map((f) => f.key.split(":")[1]),
      ).size;
    ["rim", "mid", "inner"].forEach((ring, z) => expect(count(z), ring).toBe(12 / tiss.layout.rings[ring].every));
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

  it("the bays' boxes carry on starboard from the Berths' without overlapping", () => {
    const xs = (key) => faces.filter((f) => f.key === key).flatMap((f) => f.pts.map((p) => p[0]));
    const [berth, bay1, bay2] = ["tiss.berth", "tiss.bay-1", "tiss.bay-2"].map(xs);
    expect(Math.min(...bay1)).toBeGreaterThanOrEqual(Math.max(...berth));
    expect(Math.min(...bay2)).toBeGreaterThanOrEqual(Math.max(...bay1));
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

  it("lights each of the Old Shops in its own cell, jutting fore of Inner 7:30 past the ring's face", () => {
    const shops = ["tiss.sweeper-bay", "tiss.racks", "tiss.cutting-floor", "tiss.old-dock", "tiss.cradle-room"];
    const keys = shops.map((id) => keyOf(locate(index, { roomId: id }, null)));
    expect(new Set(keys).size).toBe(shops.length);
    let prev = RWZ[2];
    for (const key of keys) {
      const zs = faces.filter((f) => f.key === key).flatMap((f) => f.pts.map((p) => p[2]));
      expect(zs.length, key).toBeGreaterThan(0);
      expect(Math.min(...zs)).toBeCloseTo(prev); // each starts where the one before it ends
      prev = Math.max(...zs);
    }
  });

  it("draws the Old Shops' cells the ring segment's full width, a wing carrying the ring on fore", () => {
    const xy = (key) => {
      const pts = faces.filter((f) => f.key === key).flatMap((f) => f.pts);
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    };
    const ring = xy("r2:15:2");
    xy("r2:15:7").forEach((v, i) => expect(v).toBeCloseTo(ring[i]));
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

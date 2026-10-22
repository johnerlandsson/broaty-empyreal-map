import { describe, expect, it } from "vitest";
import wenna from "../data/wenna.js";
import { DRUMS, buildDrumModel, drumHour, drumKey, drumLayout, drumShape } from "./drum.js";
import { indexStation, locate } from "./locate.js";

const sub = (a, b) => a.map((c, i) => c - b[i]);
const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
const centroid = (pts) => pts.reduce((s, p) => s.map((c, i) => c + p[i] / pts.length), [0, 0, 0]);
// the renderer's normal: from the first three points
const normal = ([a, b, c]) => cross(sub(b, a), sub(c, a));

// Orrin Station was a drum until it was rebuilt on decks (decks.test.js).
describe.each([["Wenna Halt", "wenna", wenna, "lounge", 0.6]])("%s", (_, p, data, up, g) => {
  const spec = DRUMS[p];
  const index = indexStation(data);
  const faces = buildDrumModel(index, spec);
  const ids = data.rooms.map((r) => r.id);
  const axisId = `${p}.${up}`;

  describe("the data", () => {
    it(`has the six rooms of content/areas/${p}.yaml`, () => {
      expect(ids.sort()).toEqual(["berth", "charts", "concourse", "freight", up, "market"].map((n) => `${p}.${n}`).sort());
    });

    it("puts the hall at the station's gravity and the axis room nearer zero", () => {
      expect(index.byId.get(`${p}.concourse`).gravity).toBe(g);
      expect(index.byId.get(axisId).gravity).toBeLessThan(g);
    });

    it("locates every room on the one plan", () => {
      for (const id of ids) expect(locate(index, { roomId: id }, null)).toMatchObject({ kind: "room", id, level: 0 });
    });
  });

  describe("buildDrumModel", () => {
    it("lights faces for every room", () => {
      for (const id of ids) expect(faces.some((f) => f.key === id), id).toBe(true);
    });

    it("winds every culled face to face outward", () => {
      // outward: away from the axis for the drum, its caps and the collar, away from a cradle's centre
      const cradles = faces.filter((f) => f.kind === "dock");
      for (const f of faces) {
        const c = centroid(f.pts);
        let from;
        if (f.kind === "dock") {
          // the cradle this face belongs to: the six faces of a box are consecutive
          const i = cradles.indexOf(f);
          from = centroid(cradles.slice(i - (i % 6), i - (i % 6) + 6).flatMap((g) => g.pts));
        } else if (f.kind.endsWith("cap")) {
          from = [c[0] * 0.5, c[1] * 0.5, c[2] > 0 ? c[2] - 10 : c[2] + 10];
        } else {
          from = [0, 0, c[2]];
        }
        expect(dot(normal(f.pts), sub(c, from)), `${f.kind} ${f.key}`).toBeGreaterThan(0);
      }
    });

    it("puts the Exchange fore of the Concourse and the Freight Office aft", () => {
      const z = (id) => centroid(faces.filter((f) => f.key === id).flatMap((f) => f.pts))[2];
      expect(z(`${p}.market`)).toBeGreaterThan(z(`${p}.concourse`));
      expect(z(`${p}.freight`)).toBeLessThan(z(`${p}.concourse`));
    });

    it("gives the cradles an anchor and draws the axis room over the drum", () => {
      for (const f of faces.filter((f) => f.kind === "dock")) expect(f.anchor).toHaveLength(3);
      for (const f of faces.filter((f) => f.key === axisId)) expect(f.layer).toBeGreaterThan(0);
    });
  });

  describe("drumKey and drumHour", () => {
    it("keys a room by its id and nothing else", () => {
      expect(drumKey({ kind: "room", id: `${p}.berth` })).toBe(`${p}.berth`);
      expect(drumKey({ kind: "off", name: "" })).toBe(null);
      expect(drumKey(null)).toBe(null);
    });

    it("turns the drum to a room's hour, and not for the axis room", () => {
      expect(drumHour(index, { kind: "room", id: `${p}.concourse` })).toBe(0);
      expect(drumHour(index, { kind: "room", id: `${p}.berth` })).toBe(1);
      expect(drumHour(index, { kind: "room", id: `${p}.charts` })).toBe(11);
      expect(drumHour(index, { kind: "room", id: axisId })).toBe(null);
      expect(drumHour(index, { kind: "off" })).toBe(null);
    });
  });

  describe("drumLayout", () => {
    const layout = drumLayout(index, spec);
    const rectOf = (id) => drumShape(layout, { kind: "room", id });

    it("has a shape for every room", () => {
      for (const id of ids) expect(rectOf(id), id).not.toBe(null);
      expect(drumShape(layout, { kind: "room", id: "tiss.market" })).toBe(null);
      expect(drumShape(layout, { kind: "off" })).toBe(null);
    });

    it("lays the rooms out as the exits go", () => {
      const mid = (id) => {
        const s = rectOf(id);
        return s.kind === "circle" ? [s.cx, s.cy] : [s.x + s.width / 2, s.y + s.height / 2];
      };
      const [hx, hy] = mid(`${p}.concourse`);
      expect(mid(`${p}.market`)[1]).toBeLessThan(hy); // north is up
      expect(mid(`${p}.freight`)[1]).toBeGreaterThan(hy);
      expect(mid(`${p}.berth`)[0]).toBeGreaterThan(hx); // east is right
      expect(mid(`${p}.charts`)[0]).toBeLessThan(hx);
    });

    it("overlaps no two rooms", () => {
      const boxes = layout.boxes.map((b) => [b.cx - b.w / 2, b.cy - b.h / 2, b.cx + b.w / 2, b.cy + b.h / 2]);
      const a = layout.axis;
      boxes.push([a.cx - a.r, a.cy - a.r, a.cx + a.r, a.cy + a.r]);
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const [a, b] = [boxes[i], boxes[j]];
          expect(a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1], `${i} ${j}`).toBe(true);
        }
      }
    });
  });
});

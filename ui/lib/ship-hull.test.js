// The painter's sort on a ship: from the band camera and from astern, no face of the skiff or the
// freighter in row C's look (bells, the boom, greebles, window panes, the collar's ring and the
// hull itself) is drawn under a face it's in front of. Faces are sorted as ModelView.draw sorts
// them: by layer, then by the depth of their centroid.

import { describe, expect, it } from "vitest";
import freighterPlan from "../data/plans/freighter.js";
import skiffPlan from "../data/plans/hull-skiff.js";
import { buildDecksModel, indexDecks } from "./decks.js";
import { camera } from "./geometry.js";

const ROW_C = {
  profile: { bevel: 0.12, noseDrop: 0.35, noseLength: 0.8, spine: null },
  surface: { seams: true, windows: ["cockpit"], stripe: { paint: "residential", at: 0.3, width: 0.14 }, navLights: true },
  greebles: [],
};
// the hull looks mockup's skiff and freighter, row C (the skiff's dish moved clear of her spine)
const SHIPS = {
  skiff: {
    plan: skiffPlan,
    look: {
      hull: { 1: [[-0.67, 1.65], [0, 1.78], [0.67, 1.65], [1, 0.82], [1, -0.93], [0.67, -1.18], [-0.67, -1.18], [-1, -0.93], [-1, 0.82]] },
      profile: { ...ROW_C.profile, spine: { from: -1.1, to: 0.25, width: 1.25, height: 0.3 } },
      greebles: [
        { type: "vent", side: -0.25, frame: -0.45 },
        { type: "vent", side: 0.25, frame: -0.45 },
        { type: "antenna", side: -0.7, frame: 0.05, height: 0.7 },
        { type: "dish", side: 0.8, frame: -0.65, r: 0.14 },
      ],
      fixtures: [
        { type: "bell", side: -0.4, deck: 1, r: 0.2, len: 0.4 },
        { type: "bell", side: 0, deck: 1, r: 0.2, len: 0.4 },
        { type: "bell", side: 0.4, deck: 1, r: 0.2, len: 0.4 },
        { type: "boom", side: 0.3, deck: 1, len: 0.8 },
      ],
    },
  },
  freighter: {
    plan: freighterPlan,
    look: {
      hull: {
        1: [[-0.6, 3.37], [-0.6, 4.2, 0.58], [0.6, 4.2, 0.58], [0.6, 3.37], [1.13, 3.37, 0.13], [1.13, 0.07], [0.97, -0.13], [-0.97, -0.13], [-1.13, 0.07], [-1.13, 3.37, 0.13]],
      },
      profile: { ...ROW_C.profile, spine: { from: 0, to: 1, width: 1.5, height: 0.3 } },
      surface: { ...ROW_C.surface, windows: ["cockpit", "passage"] },
      greebles: [
        { type: "vent", side: -0.35, frame: 0.5 },
        { type: "vent", side: 0.35, frame: 0.5 },
        { type: "antenna", side: -0.85, frame: 2.4, height: 0.8 },
        { type: "dish", side: 0.8, frame: 1.6, r: 0.16 },
      ],
      fixtures: [
        { type: "bell", side: -0.6, deck: 1, r: 0.22, len: 0.4 },
        { type: "bell", side: 0.6, deck: 1, r: 0.22, len: 0.4 },
        { type: "chevrons", room: "collar", wall: "starboard" },
      ],
    },
  },
};
const CAMERAS = { "the band camera": { yaw: 16, pitch: 38 }, "astern": { yaw: 196, pitch: 24 } };

const sub = (a, b) => a.map((c, i) => c - b[i]);
const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
const inside = (P, [x, y]) => {
  let odd = false;
  P.forEach((a, i) => {
    const b = P[(i + 1) % P.length];
    if (a[1] > y !== b[1] > y && x < a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0])) odd = !odd;
  });
  return odd;
};
// the depth of a projected face's plane under a screen point, or null for one seen edge on
const depthAt = (P, [x, y]) => {
  const n = cross(sub(P[1], P[0]), sub(P[2], P[0]));
  return Math.abs(n[2]) < 1e-9 ? null : P[0][2] - (n[0] * (x - P[0][0]) + n[1] * (y - P[0][1])) / n[2];
};
const where = (f) => f.pts.reduce((s, p) => s.map((v, k) => v + p[k] / f.pts.length), [0, 0, 0]).map((v) => v.toFixed(0)).join(",");

/** Every face drawn before a later one that covers its centroid while it's more than a unit in front of it. */
function buried(data, cam) {
  const faces = buildDecksModel(indexDecks(data), data).filter((f) => !f.ghost && f.lid == null);
  const shown = faces
    .map((f) => {
      const P = f.pts.map(cam.project);
      return { f, P, depth: P.reduce((s, p) => s + p[2], 0) / P.length };
    })
    .filter(({ f }) => !f.cull || cam.project(cross(sub(f.pts[1], f.pts[0]), sub(f.pts[2], f.pts[0])))[2] >= 0)
    .sort((a, b) => a.f.layer - b.f.layer || a.depth - b.depth);
  const out = [];
  shown.forEach((a, i) => {
    const c = a.P.reduce((s, p) => s.map((v, k) => v + p[k] / a.P.length), [0, 0, 0]);
    for (const b of shown.slice(i + 1)) {
      if (!inside(b.P, c)) continue;
      const z = depthAt(b.P, c);
      if (z !== null && c[2] > z + 1) out.push(`${a.f.kind} at ${where(a.f)} under ${b.f.kind} at ${where(b.f)}, ${(c[2] - z).toFixed(1)} in front`);
    }
  });
  return { shown, out };
}

describe("the painter's sort on a ship, row C", () => {
  for (const [name, { plan, look }] of Object.entries(SHIPS)) {
    const data = { ...plan, look: { ...plan.look, ...ROW_C, footprints: {}, ...look } };
    for (const [from, angle] of Object.entries(CAMERAS)) {
      it(`draws nothing of the ${name} under a face it's in front of, from ${from}`, () => {
        const { shown, out } = buried(data, camera(angle));
        // the things it's about are there to be checked
        for (const kind of ["dock", "lamp", "outer"]) expect(shown.some(({ f }) => f.kind === kind), kind).toBe(true);
        expect(out).toEqual([]);
      });
    }
  }
});

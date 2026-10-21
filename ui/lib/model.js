// The station as a list of flat 3D faces for the painter's-algorithm renderer.
// Station frame: X = 3 o'clock, Y = 12 o'clock, Z = fore along the axis.
// Pure; no DOM.

import {
  ang,
  BLZ,
  DISTRICT_COLOURS,
  districtOf,
  HUBR,
  HUBZ,
  P3,
  RR,
  RT,
  RWZ,
  SLICE,
  SPOKE_HOURS,
  SPR,
  SPZ,
} from "./geometry.js";

/**
 * @typedef {{pts: number[][], kind: string, key: string|null, tint: string|null,
 *   edges: boolean[], turns: boolean}} Face
 * @param {ReturnType<typeof import("./locate.js").indexStation>} index
 * @returns {Face[]}
 */
export function buildModel(index) {
  const faces = [];
  const add = (pts, kind, key, tint, edges, turns) =>
    faces.push({ pts, kind, key, tint, edges: edges ?? pts.map(() => true), turns });

  // Rings: one segment per corridor stop, five slices across the deck.
  for (const z of [0, 1, 2]) {
    const stops = index.corridors[z];
    const span = 12 / stops.length;
    const R0 = RR[z] - RT[z];
    const R1 = RR[z] + RT[z];
    const w = RWZ[z];
    for (const c of stops) {
      const h = c.x / 2;
      const h0 = h - span / 2;
      const h1 = h + span / 2;
      const tint = DISTRICT_COLOURS[districtOf(z, c.x)];
      for (let s = 0; s < 5; s++) {
        const z0 = SLICE[s] * w;
        const z1 = SLICE[s + 1] * w;
        const key = `r${z}:${c.x}:${s - 2}`;
        add([P3(R1, h0, z0), P3(R1, h1, z0), P3(R1, h1, z1), P3(R1, h0, z1)], "outer", key, tint, [s === 0, true, s === 4, true], true);
        add([P3(R0, h0, z1), P3(R0, h1, z1), P3(R0, h1, z0), P3(R0, h0, z0)], "inner", key, tint, [s === 4, true, s === 0, true], true);
        if (s === 4) add([P3(R0, h0, z1), P3(R1, h0, z1), P3(R1, h1, z1), P3(R0, h1, z1)], "fore", key, tint, null, true);
        if (s === 0) add([P3(R1, h0, z0), P3(R0, h0, z0), P3(R0, h1, z0), P3(R1, h1, z0)], "aft", key, tint, null, true);
      }
    }
  }

  // A box centred on c with half-sizes hx/hy/hz, optionally rolled about the axis by `rot` hours.
  const box = (c, hx, hy, hz, kind, key, turns, rot = 0) => {
    const a = ang(rot);
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const v = (sx, sy, sz) => {
      const x = c[0] + sx * hx;
      const y = c[1] + sy * hy;
      return rot ? [x * cos + y * sin, -x * sin + y * cos, c[2] + sz * hz] : [x, y, c[2] + sz * hz];
    };
    const sides = [
      [v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1)],
      [v(-1, 1, -1), v(1, 1, -1), v(1, -1, -1), v(-1, -1, -1)],
      [v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1)],
      [v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1), v(-1, 1, -1)],
      [v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), v(1, -1, 1)],
      [v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1), v(-1, -1, -1)],
    ];
    for (const pts of sides) add(pts, kind, key, null, null, turns);
  };

  // Spokes: three legs per spoke hour, one key per stretch between floors.
  const LV = [RR[0] - RT[0], RR[1] + RT[1], RR[1] - RT[1], RR[2] + RT[2], RR[2] - RT[2], HUBR];
  const LEGS = [[0, 1], [2, 3], [4, 5]];
  for (const h of SPOKE_HOURS) {
    LEGS.forEach(([a, b], leg) => {
      const n = 4;
      const seg = (LV[a] - LV[b]) / n;
      for (let i = 0; i < n; i++) box([0, LV[b] + seg * (i + 0.5), 0], 8, seg / 2, 8, "spoke", `spoke:${h}:${leg}`, true, h);
    });
  }

  // Octagonal / square prism along the axis, with caps.
  const prism = (r, z0, z1, n, kind, key, turns) => {
    const a = (i) => ((i + 0.5) / n) * 12;
    for (let i = 0; i < n; i++) {
      add([P3(r, a(i), z0), P3(r, a(i + 1), z0), P3(r, a(i + 1), z1), P3(r, a(i), z1)], kind, key, null, null, turns);
    }
    add(Array.from({ length: n }, (_, i) => P3(r, a(i), z1)), `${kind}-cap`, key, null, null, turns);
    add(Array.from({ length: n }, (_, i) => P3(r, a(n - i), z0)), `${kind}-cap`, key, null, null, turns);
  };

  prism(HUBR, -HUBZ, HUBZ, 8, "hub", "tiss.hub", true);
  prism(23, HUBZ, HUBZ + 16, 8, "bearing", "tiss.bearing", false);
  for (const n of [1, 2, 3, 4]) prism(SPR, SPZ(n) - 36, SPZ(n) + 36, 4, "spine", `tiss.spine-${n}`, false);
  prism(SPR, HUBZ + 16, SPZ(1) - 36, 4, "spine", null, false);
  prism(26, BLZ - 12, BLZ + 4, 8, "blister", "tiss.blister", false);
  prism(16, BLZ + 4, BLZ + 18, 8, "blister", "tiss.blister", false);

  box([0, 0, -HUBZ - 14], 18, 14, 14, "dock", "tiss.transfer", true);

  // Spine side rooms: docks to port (x<0) and starboard (x>0) of each spine section.
  for (const room of index.byId.values()) {
    if (room.z !== 3 || room.x === 0 || room.y < 2 || room.y > 5) continue;
    box([Math.sign(room.x) * (SPR + 26), 0, SPZ(room.y - 1)], 26, 16, 28, "dock", room.id, false);
  }

  // Two skiffs beside Spine 3 starboard.
  box([SPR + 52 + 40, 8, SPZ(3) - 14], 34, 9, 10, "ship", null, false);
  box([SPR + 52 + 40, -8, SPZ(3) + 16], 34, 9, 10, "ship", null, false);

  return faces;
}

// The top band while you walk Tamsin's land (spec, "The top band"; docs/maps/reference/land-picked.png):
// Tamsin from above as a whole low-poly globe on the seeded stars, its facets in its own colours
// (faceOf("tamsin"): its ground, and its sea on its share of them), lit from a fixed light at the
// upper left with no day and night, and your spot amber with its ring and the glow. The globe is
// turned to Zennor's latitude so your spot sits a little north of the middle; your coords (km
// from Zennor's point, at most about 30) move it along the ground, so in practice it's Zennor's
// spot. No text and no weather. Two layers, as the unknown view's: the stars slice to fill the band,
// the globe is met to fit.

import { el, glowFilter, stars } from "./lib/svg.js";
import { faceOf, hex, seedOf } from "./lib/worlds.js";

const W = 380;
const H = 250;
const BG = "#04060c";
const AMBER = "#ffb347";
const STARS = 150;
const STAR_SEED = 3;

/** Tamsin's radius in km. Not in data/worlds.js: world.yaml's planets.gm comment says "1 g at 6,400 km". */
export const RADIUS_KM = 6400;
/** The globe's radius in px, and its middle a little below the band's. */
const R = 105;
const CX = W / 2;
const CY = H / 2 + 4;
/** How far north of the middle your spot sits: the mockup's 22 px on its 92 px globe. */
const NORTH = Math.asin(22 / 92);
/** The fixed light: upper left and towards you, in screen terms (y down). */
const LIGHT = (() => {
  const l = [-0.55, -0.45, 0.7];
  const n = Math.hypot(...l);
  return l.map((v) => v / n);
})();
/** Points over the near side, spiralled evenly and jittered a little, and a ring of them on the limb. */
const POINTS = 120;
const LIMB = 30;

const DEG = Math.PI / 180;
let ids = 0;

/** Bowyer-Watson Delaunay, small n, as the mockup's: the triangles of P as index triples. */
function delaunay(P) {
  const big = 1e4;
  const pts = P.concat([[-big, -big], [big, -big], [0, big]]);
  const n = P.length;
  let tris = [[n, n + 1, n + 2]];
  const circ = (t) => {
    const [a, b, c] = t.map((i) => pts[i]);
    const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
    const s = (p) => p[0] ** 2 + p[1] ** 2;
    const ux = (s(a) * (b[1] - c[1]) + s(b) * (c[1] - a[1]) + s(c) * (a[1] - b[1])) / d;
    const uy = (s(a) * (c[0] - b[0]) + s(b) * (a[0] - c[0]) + s(c) * (b[0] - a[0])) / d;
    return [ux, uy, (a[0] - ux) ** 2 + (a[1] - uy) ** 2];
  };
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const bad = tris.filter((t) => {
      const [x, y, r] = circ(t);
      return (p[0] - x) ** 2 + (p[1] - y) ** 2 < r;
    });
    const edges = [];
    for (const t of bad) {
      for (const [u, v] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) {
        const j = edges.findIndex(([a, b]) => (a === v && b === u) || (a === u && b === v));
        if (j >= 0) edges.splice(j, 1);
        else edges.push([u, v]);
      }
    }
    tris = tris.filter((t) => !bad.includes(t));
    for (const [u, v] of edges) tris.push([u, v, i]);
  }
  return tris.filter((t) => t.every((i) => i < n));
}

/**
 * The globe's facets, each `{ pts: [[x, y] ×3] on the unit disc, fill: [r, g, b] }`, seeded by the
 * world's id so they're the same every time. Seas lie where a smooth seeded field is lowest, on
 * about their share of the facets, so they clump as seas do.
 */
export function globeFacets(face, rnd) {
  const P = [];
  for (let i = 0; i < POINTS; i++) {
    const z = 1 - (i + 0.5) / POINTS;
    const r = Math.sqrt(1 - z * z) * (i ? 1 - rnd() * 0.04 : 1);
    const th = i * 2.39996 + (rnd() - 0.5) * 0.25;
    P.push([Math.cos(th) * r, Math.sin(th) * r]);
  }
  for (let i = 0; i < LIMB; i++) {
    const th = (i / LIMB) * 2 * Math.PI;
    P.push([Math.cos(th), Math.sin(th)]);
  }
  const waves = Array.from({ length: 3 }, () => ({ k: [rnd() * 6 - 3, rnd() * 6 - 3, rnd() * 6 - 3], p: rnd() * 2 * Math.PI, a: 0.5 + rnd() * 0.5 }));
  const field = ([x, y, z]) => waves.reduce((s, w) => s + w.a * Math.sin(w.k[0] * x + w.k[1] * y + w.k[2] * z + w.p), 0);
  const tris = delaunay(P).map((t) => {
    const pts = t.map((i) => P[i]);
    const mx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3;
    const my = (pts[0][1] + pts[1][1] + pts[2][1]) / 3;
    const nz = Math.sqrt(Math.max(0, 1 - mx * mx - my * my));
    const lit = Math.max(0.12, mx * LIGHT[0] + my * LIGHT[1] + nz * LIGHT[2]);
    return { pts, lit, f: field([mx, my, nz]), k: 0.35 + lit * 0.95 + (rnd() - 0.5) * 0.08 };
  });
  // each sea takes the lowest of the field still ground, its share of the facets, largest sea first
  const order = tris.map((t, i) => i).sort((a, b) => tris[a].f - tris[b].f);
  const sea = new Map();
  let at = 0;
  for (const s of face.seas) {
    const n = Math.round(s.share * tris.length);
    for (const i of order.slice(at, at + n)) sea.set(i, s.rgb);
    at += n;
  }
  return tris.map((t, i) => ({ pts: t.pts, fill: (sea.get(i) ?? face.ground).map((v) => Math.min(255, v * t.k)) }));
}

export class LandGlobe {
  /**
   * @param {HTMLElement} modelEl the top band
   * @param {{ latitude: number }} opts Zennor's latitude, degrees north (data/sky.js)
   */
  constructor(modelEl, { latitude }) {
    this.lat = latitude * DEG;
    this.lat0 = this.lat - NORTH; // the globe's middle: your spot is NORTH above it
    const n = ++ids;

    this.div = document.createElement("div");
    this.div.className = "land-globe";
    Object.assign(this.div.style, { position: "relative", width: "100%", height: "100%", overflow: "hidden", background: BG });
    modelEl.appendChild(this.div);
    const layer = (fit) => {
      const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: `xMidYMid ${fit}`, "aria-hidden": "true" });
      Object.assign(svg.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
      this.div.appendChild(svg);
      return svg;
    };
    stars(layer("slice"), 0, 0, W, H, STARS, STAR_SEED);

    const svg = layer("meet");
    const defs = el("defs", {}, svg);
    const face = faceOf("tamsin");
    const rim = `land-globe-rim-${n}`;
    const glow = `land-globe-glow-${n}`;
    const grad = el("radialGradient", { id: rim, cx: "50%", cy: "50%", r: "50%" }, defs);
    el("stop", { offset: "86%", "stop-color": hex(face.rim), "stop-opacity": 0 }, grad);
    el("stop", { offset: "100%", "stop-color": hex(face.rim), "stop-opacity": 0.26 }, grad);
    glowFilter(defs, glow);

    el("circle", { cx: CX, cy: CY, r: R + 6, fill: `url(#${rim})` }, svg);
    el("circle", { cx: CX, cy: CY, r: R, fill: hex(face.ground.map((v) => v * 0.4)), "data-globe": "" }, svg);
    for (const f of globeFacets(face, seedOf("tamsin"))) {
      const fill = hex(f.fill);
      const points = f.pts.map(([x, y]) => `${(CX + x * R).toFixed(1)},${(CY + y * R).toFixed(1)}`).join(" ");
      el("polygon", { points, fill, stroke: fill, "stroke-width": 0.6 }, svg);
    }
    this.spot = el("circle", { r: 4.5, fill: AMBER, "fill-opacity": 0.3, stroke: AMBER, "stroke-width": 2.4, filter: `url(#${glow})` }, svg);
    this.set({ x: 0, y: 0 });
  }

  /** Put your spot at `coords`, km east (x) and north (y) of Zennor's point. */
  set(coords) {
    const lat = this.lat + (coords?.y ?? 0) / RADIUS_KM;
    const lon = (coords?.x ?? 0) / RADIUS_KM;
    // orthographic, the globe's middle at (lat0, 0): x east, y north
    const x = Math.cos(lat) * Math.sin(lon);
    const y = Math.cos(this.lat0) * Math.sin(lat) - Math.sin(this.lat0) * Math.cos(lat) * Math.cos(lon);
    this.spot.setAttribute("cx", (CX + x * R).toFixed(2));
    this.spot.setAttribute("cy", (CY - y * R).toFixed(2));
  }

  show(on) {
    this.div.style.display = on ? "" : "none";
  }
}

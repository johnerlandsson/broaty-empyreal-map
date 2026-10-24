// The lanes map: the galaxy's twenty systems over the top band, switched on and off by a ⋈ button
// left of the chart's ◎ (docs/maps/lanes.md). The Shallows a ring of trunks in ring order, the Mid a
// disc inside it with its deep stars nearest the centre, as public as help lanes and help mid make
// them; nothing is placed where the stars are. Drawn on it: the lanes of your system open now, and
// branches you've seen open elsewhere, fading as the sighting ages; a key at the right says the rest.
// Zooms and pans like the chart, the names staying their size as the stars spread. Marks and colours
// are the style guide's §13.5.

import {
  SYSTEMS,
  agoText,
  cleanLanes,
  lane,
  laneFix,
  laneName,
  lanePath,
  layout,
  openHere,
  seenOpenElsewhere,
  systemName,
} from "./lib/lanes.js";
import { attachPanZoom, el, glowFilter, stars, zoomButtons } from "./lib/svg.js";

const HL = "#ffb347";
const HL_STROKE = "#fff3df";
const DIM = "#7d8a9a";
const ORBIT = "#2b3646";
const STAR = "#fffaf0";
const GLASS = "#cfe3ff";
const BG = "#04060c";
const NAME = "#c3ccd8";
const TEXT = "#e3eaf2";
const TONES = ["#3a4556", "#58667b", "#7e8da3"];
const DISC = { mid: "#0c1320", core: "#131b2b" };
const FONT = "Inter, system-ui, sans-serif";

const KEY_W = 150; // the key's column at the band's right, clear of ⋈ and the zoom buttons' column
const KEY_TOP = 44; // below ⋈
const ZOOM_IN = 6; // as far in as six times the fit
const STEPS = 32; // segments a lane's curve is drawn in
const BY_ID = new Map(SYSTEMS.map((s) => [s.id, s]));
const BANDS = Object.fromEntries(SYSTEMS.map((s) => [s.id, s.band]));
const CLASS = { trunk: "trunk", branch: "branch", mid: "Mid branch" };
const LAYOUT = layout();
const PATHS = new Map(); // a lane's path, worked out once

let instances = 0;

function pathOf(l) {
  if (!PATHS.has(l.id)) PATHS.set(l.id, lanePath(l, LAYOUT, BANDS));
  return PATHS.get(l.id);
}

/** Seconds as "3m 40s", "1h 2m" or "40s". */
function span(s) {
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

/** A sighting's opacity: an hour old, a day old, older. Only its age; nothing about what's next. */
const fade = (ms) => (ms < 3600_000 ? 0.75 : ms < 86400_000 ? 0.5 : 0.3);

/** A lane's look open: a trunk the ring's, a branch solid Glass, a Mid branch dashed Glass. */
const openLine = (l) => ({ stroke: GLASS, "stroke-width": 1.8, "stroke-dasharray": l.class === "mid" ? "6 2.5" : "none" });

export class LanesView {
  /**
   * @param {HTMLElement} bandEl the top band
   * @param {{onToggle?: (on: boolean) => void}} [opts] onToggle is called when the user flips ⋈
   */
  constructor(bandEl, opts = {}) {
    this.band = bandEl;
    this.onToggle = opts.onToggle ?? (() => {});
    this.lanes = null;
    this.on = false;

    const div = document.createElement("div");
    div.className = "lanes";
    Object.assign(div.style, { position: "absolute", inset: "0", zIndex: "4", display: "none", overflow: "hidden", background: BG });
    bandEl.appendChild(div);
    this.div = div;

    const svg = el("svg", {});
    Object.assign(svg.style, { display: "block", width: "100%", height: "100%" });
    div.appendChild(svg);
    this.svg = svg;
    const id = `lanes-${++instances}`;
    const defs = el("defs", {}, svg);
    glowFilter(defs, `${id}-glow`);
    const glow = defs.lastChild;
    glow.setAttribute("x", "-100%");
    glow.setAttribute("y", "-100%");
    glow.setAttribute("width", "300%");
    glow.setAttribute("height", "300%");
    glow.firstChild.setAttribute("stdDeviation", 2.2);
    stars(el("g", { "pointer-events": "none" }, svg), 0, 0, 2400, 1400, 2000, 31);
    this.marks = el("g", {}, svg);
    // her ring or chevron pulses; only the children of `lit` are replaced, so the pulse never restarts
    const hot = el("g", { filter: `url(#${id}-glow)` }, svg);
    this.pulse = el("g", {}, hot);
    this.lit = el("g", {}, this.pulse);
    el("animate", { attributeName: "opacity", values: "1;0.55;1", dur: "1.8s", repeatCount: "indefinite" }, this.pulse);
    this.key = el("g", {}, svg); // over the map, so a map panned under it doesn't hide it

    // the view, in layout units; fitted to the band until you zoom or pan, then yours until ⌂
    this.vb = null;
    this.touched = false;
    this.zoom = attachPanZoom(div, () => this.vb ?? this.fit(), (v) => this.userView(v), {
      minW: 0,
      maxW: Infinity,
    });
    zoomButtons(div, "8px", (f) => {
      if (f) this.zoom(f);
      else this.home();
    });

    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = "Lanes";
    Object.assign(btn.style, {
      position: "absolute",
      right: "64px",
      top: "8px",
      zIndex: "5",
      display: "none",
      width: "24px",
      height: "24px",
      borderRadius: "5px",
      border: `1px solid ${ORBIT}`,
      background: "var(--bg, #04060c)",
      color: "var(--fg, #dfe7f1)",
      cursor: "pointer",
      padding: "0",
    });
    // drawn, not a ⋈ glyph, as the chart's ◎ is: a glyph sits wherever the font's metrics put it
    const icon = el("svg", { viewBox: "0 0 16 16", width: 14, height: 14, fill: "none", stroke: "currentColor", "stroke-width": 1.3, "stroke-linejoin": "round" }, btn);
    icon.style.display = "block";
    icon.style.margin = "auto";
    el("path", { d: "M2.5,3 V13 L13.5,3 V13 Z" }, icon);
    btn.style.background = "color-mix(in srgb, var(--bg, #04060c) 70%, transparent)";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.setOn(!this.on);
      this.onToggle(this.on);
    });
    bandEl.appendChild(btn);
    this.btn = btn;

    new ResizeObserver(() => this.draw(Date.now())).observe(bandEl);
  }

  /** True while the map covers the band: switched on, and in contact (the game has said where you are). */
  get shown() {
    return this.on && this.ready;
  }

  get ready() {
    return !!(this.lanes && (this.lanes.system || this.lanes.transit));
  }

  /** True while she's in a lane: worth redrawing more often than once a second. */
  get moving() {
    return this.shown && !!this.lanes.transit;
  }

  /** The Lua side's lanes message, or null. */
  setLanes(msg) {
    this.lanes = msg ? cleanLanes(msg) : null;
    this.btn.style.display = this.ready ? "" : "none";
    this.sync();
    this.draw(Date.now());
  }

  /** Switch the map on or off (from the Lua side's replay, the ⋈ button, or ◎ taking the band). */
  setOn(on) {
    on = !!on;
    if (on === this.on) return;
    this.on = on;
    this.btn.style.borderColor = on ? "var(--fg-muted, #7d8a9a)" : ORBIT;
    this.sync();
    this.draw(Date.now());
  }

  sync() {
    this.div.style.display = this.shown ? "" : "none";
  }

  size() {
    return [this.band.clientWidth || 1, this.band.clientHeight || 1];
  }

  /** The view that fits the map left of the key, the ring's names inside the band. */
  fit() {
    const [w, h] = this.size();
    const mapW = Math.max(w - KEY_W, 120);
    const px = Math.max(Math.min((h - 48) / 200, (mapW - 104) / 200), 0.2); // px a unit
    const cx = mapW / 2 + 6;
    const cy = h / 2 + 2;
    return [-cx / px, -cy / px, w / px, h / px];
  }

  /** The user zoomed or panned: kept between six times in and the fit. */
  userView(v) {
    const fit = this.fit();
    if (v[2] > fit[2]) {
      if (!this.touched) return; // zoomed right out already
      return this.home();
    }
    if (v[2] < fit[2] / ZOOM_IN) return;
    this.vb = v;
    this.touched = true;
    this.draw(Date.now());
  }

  /** ⌂: back to the fit, following the band's size again. */
  home() {
    this.vb = null;
    this.touched = false;
    this.draw(Date.now());
  }

  /** Redraw at wall-clock t (ms): the ages in the key and her place in a lane change with it. */
  draw(t) {
    if (!this.shown) return;
    const [w, h] = this.size();
    this.svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    let vb = this.vb ?? this.fit();
    if (this.vb) {
      // the band's shape changed under a view of yours: keep its middle and scale
      const k = vb[2] / w;
      const cx = vb[0] + vb[2] / 2;
      const cy = vb[1] + vb[3] / 2;
      vb = this.vb = [cx - (w * k) / 2, cy - (h * k) / 2, w * k, h * k];
    }
    const u = vb[2] / w; // units a px
    const X = (p) => [(p.x - vb[0]) / u, (p.y - vb[1]) / u];
    const at = Object.fromEntries(SYSTEMS.map((s) => [s.id, X(LAYOUT.P[s.id])]));
    const lanes = this.lanes;
    const tr = lanes.transit;
    const here = lanes.system;
    const { open, closed } = openHere(lanes);
    const elsewhere = seenOpenElsewhere(lanes, t);

    const marks = document.createDocumentFragment();
    const lit = document.createDocumentFragment();
    const key = document.createDocumentFragment();
    const text = (parent, tx, ty, s, attrs = {}) =>
      el("text", { x: tx, y: ty, "font-size": 9, fill: DIM, "font-family": FONT, ...attrs }, parent, s);
    const points = (fn, from = 0, to = 1) =>
      Array.from({ length: STEPS + 1 }, (_, i) => X(fn(from + ((to - from) * i) / STEPS)).join(",")).join(" ");
    const [ox, oy] = X({ x: 0, y: 0 });

    // the Mid's disc, and a Core's inside it when there is one
    for (const d of LAYOUT.discs) {
      const r = d.r / u;
      el("circle", { cx: ox, cy: oy, r, fill: DISC[d.band], stroke: TONES[d.band === "core" ? 1 : 0], "stroke-width": 0.8, "stroke-dasharray": "2 3" }, marks);
      // named inside its rim, down and to the left, between the stars round it
      const a = (2 * Math.PI) / 3;
      text(marks, ox + (r - 9) * Math.cos(a), oy + (r - 9) * Math.sin(a), `THE ${d.band.toUpperCase()}`, {
        "text-anchor": "middle",
        "font-size": 7.5,
        "letter-spacing": 1.5,
        opacity: 0.7,
        transform: `rotate(30 ${ox + (r - 9) * Math.cos(a)} ${oy + (r - 9) * Math.sin(a)})`,
      });
    }
    // the trunks: the ring, which never closes
    el("circle", { cx: ox, cy: oy, r: 100 / u, fill: "none", stroke: TONES[2], "stroke-width": 2 }, marks);
    // branches seen open elsewhere, fading with the sighting's age
    for (const { lane: l, ago } of elsewhere) {
      el("polyline", { points: points(pathOf(l)), fill: "none", stroke: GLASS, "stroke-width": 1.2, "stroke-dasharray": "2 3", opacity: fade(ago) }, marks);
    }
    // your system's lanes open now; a trunk is the ring's already
    for (const l of open) {
      if (l.class !== "trunk") el("polyline", { points: points(pathOf(l)), fill: "none", ...openLine(l) }, marks);
    }

    // her lane: behind her solid, ahead dashed, and her chevron where her progress puts her
    const fix = laneFix(tr, t);
    if (tr && fix) {
      const l = lane(tr.lane);
      const fn = pathOf(l);
      const go = l.between[0] === tr.from ? fn : (k) => fn(1 - k);
      el("polyline", { points: points(go, 0, fix.k), fill: "none", stroke: HL, "stroke-opacity": 0.3, "stroke-width": 3, "stroke-linejoin": "round" }, marks);
      el("polyline", { points: points(go, fix.k, 1), fill: "none", stroke: HL, "stroke-opacity": 0.7, "stroke-width": 1.5, "stroke-dasharray": "4 4" }, marks);
      const p = X(go(fix.k));
      const a = X(go(Math.max(fix.k - 0.01, 0)));
      const b = X(go(Math.min(fix.k + 0.01, 1)));
      el(
        "path",
        {
          d: "M7,0 L-5,-5 L-2,0 L-5,5 Z",
          fill: HL,
          stroke: HL_STROKE,
          "stroke-width": 0.8,
          "stroke-linejoin": "round",
          transform: `translate(${p[0]} ${p[1]}) rotate(${(Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI})`,
        },
        lit,
      );
    }

    // the stars: a dot, relays as a pair of arcs either side, a Glass diamond over a settled one, its name outward
    const reach = new Set(open.map((l) => l.between.find((id) => id !== here)));
    for (const s of SYSTEMS) {
      const [x, y] = at[s.id];
      const r = s.band === "shallows" ? 4 : 3.2;
      if (s.id === here && !tr) el("circle", { cx: x, cy: y, r: r + 4.5, fill: "none", stroke: HL, "stroke-width": 2 }, lit);
      if (s.relay) {
        const rr = r + 3.5;
        for (const sx of [-1, 1]) {
          el("path", { d: `M${x + sx * rr * 0.7},${y - rr * 0.7} A${rr},${rr} 0 0 ${sx > 0 ? 1 : 0} ${x + sx * rr * 0.7},${y + rr * 0.7}`, fill: "none", stroke: TONES[2], "stroke-width": 0.9 }, marks);
        }
      }
      el("circle", { cx: x, cy: y, r, fill: STAR, opacity: s.band === "shallows" ? 0.95 : 0.8 }, marks);
      if (s.stations.length) el("path", { d: `M${x},${y - r - 7.5} l2.2,2.2 l-2.2,2.2 l-2.2,-2.2 Z`, fill: GLASS, opacity: 0.9 }, marks);
      const a = LAYOUT.P[s.id].a;
      const c = Math.cos(a);
      const side = Math.abs(c) < 0.3;
      const d = s.band === "shallows" ? 12 : 9;
      const known = s.id === here || reach.has(s.id);
      text(marks, x + c * d, y + Math.sin(a) * d + (side ? (Math.sin(a) > 0 ? 7 : -1) : 3), s.name, {
        "text-anchor": side ? "middle" : c > 0 ? "start" : "end",
        "font-size": s.band === "shallows" ? 10 : 8.5,
        fill: s.id === here ? TEXT : known ? NAME : DIM,
        opacity: known ? 1 : 0.75,
        "font-style": s.deep ? "italic" : "normal",
      });
    }

    // the key: where you are, her lane, what's open from here, and what you've seen open elsewhere
    const kx = w - KEY_W + 4;
    const kr = w - 40; // its right edge, clear of the zoom buttons
    let ky = KEY_TOP;
    const rows = [];
    const row = (dy, fn) => {
      rows.push([ky, fn]);
      ky += dy;
    };
    if (tr && fix) {
      row(fix.left === null ? 16 : 11, (y) => text(key, kx, y, `in the ${systemName(tr.to)} lane`, { fill: HL }));
      if (fix.left !== null) row(16, (y) => text(key, kx, y, `${span(fix.left)} to go`, { fill: HL, "font-size": 8.5 }));
    }
    if (here) {
      row(14, (y) => text(key, kx, y, `From ${systemName(here)}`, { fill: TEXT, "font-size": 9.5 }));
      for (const l of open) {
        row(11, (y) => {
          el("line", { x1: kx, y1: y - 3, x2: kx + 12, y2: y - 3, ...openLine(l), "stroke-width": l.class === "trunk" ? 2 : 1.6, stroke: l.class === "trunk" ? TONES[2] : GLASS }, key);
          text(key, kx + 17, y, systemName(l.between.find((id) => id !== here)), { fill: NAME });
          text(key, kr, y, CLASS[l.class], { "text-anchor": "end", "font-size": 8 });
        });
      }
      row(17, (y) => text(key, kx + 17, y, `${closed} closed · as of now`, { "font-size": 8, opacity: 0.8 }));
    }
    if (elsewhere.length) {
      row(14, (y) => text(key, kx, y, "Seen open elsewhere", { fill: TEXT, "font-size": 9.5 }));
      const room = Math.max(0, Math.floor((h - 8 - ky) / 21));
      const shown = elsewhere.length > room ? elsewhere.slice(0, Math.max(room - 1, 0)) : elsewhere;
      for (const { lane: l, ago } of shown) {
        row(21, (y) => {
          el("line", { x1: kx, y1: y - 3, x2: kx + 12, y2: y - 3, stroke: GLASS, "stroke-width": 1.3, "stroke-dasharray": "2 3", opacity: fade(ago) }, key);
          text(key, kx + 17, y, laneName(l.id), { fill: NAME });
          text(key, kx + 17, y + 9, `seen ${agoText(ago)} ago`, { "font-size": 8, opacity: 0.85 });
        });
      }
      if (shown.length < elsewhere.length) row(11, (y) => text(key, kx + 17, y, `and ${elsewhere.length - shown.length} more`, { "font-size": 8, opacity: 0.8 }));
    }
    // a backdrop behind the key, so a map zoomed or panned under it stays readable
    if (rows.length) el("rect", { x: kx - 8, y: KEY_TOP - 14, width: kr - kx + 14, height: ky - KEY_TOP + 8, rx: 6, fill: BG, opacity: 0.8 }, key);
    for (const [y, fn] of rows) fn(y);

    this.marks.replaceChildren(marks);
    this.lit.replaceChildren(lit);
    this.key.replaceChildren(key);
  }
}

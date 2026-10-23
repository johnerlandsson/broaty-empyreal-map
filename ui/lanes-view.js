// The core lanes map: a schematic of the core's six systems over the top band, switched on and off
// by a ⋈ button left of the chart's ◎ (docs/maps/lanes.md). A timetable, inner to outer down the
// band: each system a stop on the trunk line with its stations beside it, the two branches as
// brackets to the left, and a key with each branch's state as last seen. Nothing in it is placed
// where the stars are; the spacing is even. Marks and colours are the style guide's §13.5.

import { BRANCHES, LANES, SYSTEMS, cleanLanes, laneFix, laneName, laneState, systemName } from "./lib/lanes.js";
import { el, glowFilter, stars } from "./lib/svg.js";

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
const FONT = "Inter, system-ui, sans-serif";

const SPINE_X = 96; // the trunk line
const BRACKET_X = { "maelor-petroc": 50, "keyne-mabyn": 22 }; // the inner and the outer bracket
const TOP = 22; // px from the band's top to the first stop
const BOTTOM = 18; // and from the last to its bottom
const KEY_W = 140; // the key's width, at the band's right
const CHAR_W = 5; // a guess at a 9 px name's width per character (there's no layout here)

let instances = 0;

/** Seconds as "3m 40s", "1h 2m" or "40s". */
function span(s) {
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

/** A branch's line as last seen: solid Glass open, dashed closed, faint dots not seen. */
function branchLine(open) {
  if (open === true) return { stroke: GLASS, "stroke-width": 2, "stroke-dasharray": "none" };
  if (open === false) return { stroke: TONES[1], "stroke-width": 1.5, "stroke-dasharray": "5 4" };
  return { stroke: TONES[0], "stroke-width": 1.5, "stroke-dasharray": "1 4", "stroke-linecap": "round" };
}

/** The point and heading k (0 to 1) of the way along a polyline. */
function along(pts, k) {
  const segs = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    segs.push(len);
    total += len;
  }
  let d = Math.min(Math.max(k, 0), 1) * total;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i] || i === segs.length - 1) {
      const f = segs[i] > 0 ? Math.min(d / segs[i], 1) : 0;
      const [a, b] = [pts[i], pts[i + 1]];
      return { p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], angle: Math.atan2(b[1] - a[1], b[0] - a[0]), i };
    }
    d -= segs[i];
  }
  return { p: pts[0], angle: 0, i: 0 };
}

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

    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = "Core lanes";
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

  /** Redraw at wall-clock t (ms): the ages in the key and her place in a lane change with it. */
  draw(t) {
    if (!this.shown) return;
    const w = this.band.clientWidth || 1;
    const h = this.band.clientHeight || 1;
    this.svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    const lanes = this.lanes;
    const dy = Math.max((h - TOP - BOTTOM) / (SYSTEMS.length - 1), 14);
    const Y = Object.fromEntries(SYSTEMS.map((s, i) => [s.id, TOP + i * dy]));
    const x = SPINE_X;

    // each lane as a polyline from its first end to its second
    const path = (lane) => {
      const [a, b] = lane.between.map((id) => Y[id]);
      if (lane.class === "trunk") return [[x, a], [x, b]];
      const bx = BRACKET_X[lane.id];
      return [[x, a], [bx, a], [bx, b], [x, b]];
    };
    const pathD = (lane) => {
      if (lane.class === "trunk") return `M${x},${Y[lane.between[0]]} V${Y[lane.between[1]]}`;
      const [a, b] = lane.between.map((id) => Y[id]);
      const bx = BRACKET_X[lane.id];
      const r = Math.min(6, (b - a) / 2);
      return `M${x},${a} H${bx + r} Q${bx},${a} ${bx},${a + r} V${b - r} Q${bx},${b} ${bx + r},${b} H${x}`;
    };

    const marks = document.createDocumentFragment();
    const lit = document.createDocumentFragment();
    const text = (tx, ty, s, attrs = {}) =>
      el("text", { x: tx, y: ty, "font-size": 9, fill: DIM, "font-family": FONT, ...attrs }, marks, s);

    // the branches, outer first; the outer one's stub where the inner one crosses it is cut, a bridge
    const states = Object.fromEntries(BRANCHES.map((b) => [b.id, laneState(lanes, b.id, t)]));
    el("path", { d: pathD(LANES.find((l) => l.id === "keyne-mabyn")), fill: "none", ...branchLine(states["keyne-mabyn"].open) }, marks);
    const inner = BRACKET_X["maelor-petroc"];
    el("rect", { x: inner - 3, y: Y.keyne - 3, width: 6, height: 6, fill: BG }, marks);
    el("path", { d: pathD(LANES.find((l) => l.id === "maelor-petroc")), fill: "none", ...branchLine(states["maelor-petroc"].open) }, marks);
    // the trunks, which never close
    for (const lane of LANES.filter((l) => l.class === "trunk")) {
      el("path", { d: pathD(lane), fill: "none", stroke: TONES[2], "stroke-width": 2 }, marks);
    }

    // her lane: behind her solid, ahead dashed, and her chevron where her progress puts her
    const tr = lanes.transit;
    const fix = laneFix(tr, t);
    if (tr && fix) {
      const lane = LANES.find((l) => l.id === tr.lane);
      let pts = path(lane);
      if (tr.from !== lane.between[0]) pts = [...pts].reverse();
      const at = along(pts, fix.k);
      const behind = [...pts.slice(0, at.i + 1), at.p];
      const ahead = [at.p, ...pts.slice(at.i + 1)];
      const line = (p) => p.map((q) => q.join(",")).join(" ");
      el("polyline", { points: line(behind), fill: "none", stroke: HL, "stroke-opacity": 0.3, "stroke-width": 3, "stroke-linejoin": "round" }, marks);
      el("polyline", { points: line(ahead), fill: "none", stroke: HL, "stroke-opacity": 0.7, "stroke-width": 1.5, "stroke-dasharray": "4 4" }, marks);
      el(
        "path",
        {
          d: "M7,0 L-5,-5 L-2,0 L-5,5 Z",
          fill: HL,
          stroke: HL_STROKE,
          "stroke-width": 0.8,
          "stroke-linejoin": "round",
          transform: `translate(${at.p[0]} ${at.p[1]}) rotate(${(at.angle * 180) / Math.PI})`,
        },
        lit,
      );
    }

    // the stops: a star, its name, its stations as Glass diamonds
    const here = tr ? null : lanes.system;
    for (const s of SYSTEMS) {
      const y = Y[s.id];
      if (s.id === here) el("circle", { cx: x, cy: y, r: 8.5, fill: "none", stroke: HL, "stroke-width": 2 }, lit);
      el("circle", { cx: x, cy: y, r: 4.5, fill: STAR, opacity: 0.95 }, marks);
      text(x + 16, y + 3.5, s.name, { "font-size": 11, fill: s.id === here ? TEXT : NAME });
      let sx = x + 66;
      for (const st of s.stations) {
        el("path", { d: `M${sx},${y - 2.5} L${sx + 2.5},${y} L${sx},${y + 2.5} L${sx - 2.5},${y} Z`, fill: GLASS }, marks);
        text(sx + 6, y + 3, st.name);
        sx += 6 + st.name.length * CHAR_W + 12;
      }
    }

    // the key, at the right of the last stops: her lane, then each branch as last seen
    const kx = Math.max(x + 144, w - KEY_W);
    if (tr && fix) {
      const left = fix.left === null ? "" : ` · ${span(fix.left)}`;
      text(kx, Y.maelor + 3, `in the ${systemName(tr.to)} lane${left}`, { fill: HL });
    }
    const keyRows = [Y.elowen, Y.mabyn];
    BRANCHES.forEach((b, i) => {
      const ky = keyRows[i];
      el("line", { x1: kx, y1: ky - 3, x2: kx + 16, y2: ky - 3, ...branchLine(states[b.id].open) }, marks);
      text(kx + 22, ky, laneName(b.id));
      text(kx + 22, ky + 9, states[b.id].words, { "font-size": 8, opacity: 0.85 });
    });

    this.marks.replaceChildren(marks);
    this.lit.replaceChildren(lit);
  }
}

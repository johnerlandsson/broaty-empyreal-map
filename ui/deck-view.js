// The deck plan: the floor the player is on, drawn as a true floor plan on a dark starfield.
// T.I.S.S.'s four plans (Rim, Mid, Inner, Docks), or another station's, are built once; set() only
// toggles visibility, moves the highlight and adjusts the viewBox. Layout maths lives in
// lib/deck-layout.js; the room boxes and labels here are shared with drum-deck.js.

import { DISTRICT_COLOURS as DC, SPOKE_HOURS, ang, districtOf } from "./lib/geometry.js";
import {
  BEARING,
  CH,
  HULLY,
  MAX_W,
  MIN_W,
  HUB_R,
  NODE,
  SN,
  SX,
  docksLayout,
  fitWidth,
  highlightShape,
  shapeKey,
  ringLayout,
} from "./lib/deck-layout.js";
import { attachPanZoom, el, glowFilter, rng, stars, zoomButtons } from "./lib/svg.js";

const HL = "#ffb347";
export const TXT = "#e3eaf2";
export const DIM = "#7d8a9a";
export const PLATE = "#18202b";
const EDGE = "#3b4a5c";
const CORR = "#262f3b";
const LADDER = "#9fb0c3";
export const PASSAGE = "#56657a";
const BASE_W = 600;
const BASE_H = 520;

let instances = 0;

const hourLabel = (h) => `${Math.floor(h) || 12}:${h % 1 ? "30" : "00"}`;

export function label(parent, x, y, s, size, attrs) {
  return el(
    "text",
    {
      x,
      y,
      "font-size": size,
      fill: TXT,
      "text-anchor": "middle",
      "dominant-baseline": "middle",
      "font-family": "Inter, system-ui, sans-serif",
      "pointer-events": "none",
      ...attrs,
    },
    parent,
    s,
  );
}

/** Show a tooltip while the pointer is over node. */
export function hover(node, room) {
  if (!room) return;
  node.addEventListener("mouseenter", () => {
    window.panel?.tooltip?.show(node.getBoundingClientRect(), {
      title: room.name,
      body: room.address && room.address.toLowerCase() !== String(room.name).toLowerCase() ? room.address : "",
      rows: room.closed ? [{ label: "Closed", value: room.closedReason, valueColor: "muted" }] : [],
    });
  });
  node.addEventListener("mouseleave", () => window.panel?.tooltip?.hide?.());
}

/** A room box tinted by district, labelled; closed rooms are dashed and dimmed. */
export function roomBox(parent, room, cx, cy, col, w, h) {
  const g = el("g", {}, parent);
  const open = !room.closed;
  el(
    "rect",
    {
      x: cx - w / 2,
      y: cy - h / 2,
      width: w,
      height: h,
      rx: 5,
      fill: col,
      "fill-opacity": open ? 0.22 : 0.07,
      stroke: col,
      "stroke-opacity": open ? 0.85 : 0.5,
      "stroke-width": 1.6,
      "stroke-dasharray": open ? "none" : "5 4",
    },
    g,
  );
  const name = room.name && room.name !== "?" ? room.name : "?";
  const words = name.split(" ");
  const half = Math.ceil(words.length / 2);
  const lines =
    name.length > 14 && words.length > 1 ? [words.slice(0, half).join(" "), words.slice(half).join(" ")] : [name];
  lines.forEach((t, i) => label(g, cx, cy + (i - (lines.length - 1) / 2) * 14, t, 12, { opacity: open ? 1 : 0.6 }));
  if (!open) label(g, cx, cy + h / 2 - 8, "closed", 9, { fill: DIM });
  hover(g, room);
  return g;
}

/** Transparent hit area so a corridor stretch or spine segment can show a tooltip. */
function hitArea(parent, x, y, w, h, room) {
  const r = el("rect", { x, y, width: w, height: h, fill: "transparent" }, parent);
  hover(r, room);
}

function buildRingPlan(svg, index, z) {
  const layout = ringLayout(index, z);
  const { length: L, stops } = layout;
  const g = el("g", { display: "none" }, svg);
  for (const off of [-L, 0, L]) {
    const s = el("g", { transform: `translate(${off} 0)` }, g);
    // hull plate, seams and lit portholes along the fore and aft hull walls
    el("rect", { x: -NODE / 2, y: -HULLY, width: L, height: 2 * HULLY, fill: PLATE }, s);
    for (let i = 0; i < stops.length; i++) {
      el("line", { x1: i * NODE - NODE / 2, y1: -HULLY, x2: i * NODE - NODE / 2, y2: HULLY, stroke: "#202a36", "stroke-width": 1 }, s);
    }
    [-HULLY, HULLY].forEach((y) =>
      el("line", { x1: -NODE / 2, y1: y, x2: L - NODE / 2, y2: y, stroke: EDGE, "stroke-width": 3 }, s),
    );
    const r = rng(z * 31 + 5);
    for (let i = 0; i < stops.length * 8; i++) {
      if (r() < 0.4) continue;
      const x = -NODE / 2 + (i * NODE) / 8 + 9;
      [-1, 1].forEach((sg) =>
        el("circle", { cx: x, cy: sg * (HULLY - 7), r: 1.6, fill: "#ffd98a", opacity: 0.25 + r() * 0.6 }, s),
      );
    }
    // corridor band with a district-colour underline
    el("rect", { x: -NODE / 2, y: -CH, width: L, height: 2 * CH, fill: CORR }, s);
    for (const st of stops) {
      el("rect", { x: st.cx - NODE / 2 + 2, y: CH - 3, width: NODE - 4, height: 3, fill: DC[districtOf(z, st.x)], opacity: 0.8 }, s);
    }
    // rooms and the passages that join them to the corridor
    for (const b of layout.rooms) {
      el("rect", { x: b.door.x, y: b.door.y, width: b.door.w, height: b.door.h, fill: PASSAGE }, s);
      roomBox(s, b.room, b.cx, b.cy, DC[districtOf(z, b.room.x)], b.w, b.h);
    }
    // stops: plain nodes, or a lift lobby with a ladder hatch beside it
    for (const st of stops) {
      const room = index.byId.get(st.id);
      hitArea(s, st.cx - NODE / 2, -CH, NODE, 2 * CH, room);
      if (SPOKE_HOURS.includes(st.hour) || st.lobby) {
        el("circle", { cx: st.cx, cy: 0, r: 12, fill: "#0e131a", stroke: "#cfd8e3", "stroke-width": 2, "pointer-events": "none" }, s);
        label(s, st.cx, 1, "⇅", 13, { fill: "#cfd8e3" });
        el("rect", { x: st.cx + 20, y: -7, width: 14, height: 14, rx: 2, fill: "none", stroke: LADDER, "stroke-width": 1.4, "pointer-events": "none" }, s);
        el("path", { d: `M${st.cx + 23},-3h8M${st.cx + 23},0h8M${st.cx + 23},3h8`, stroke: LADDER, "stroke-width": 1, "pointer-events": "none" }, s);
      } else {
        el("circle", { cx: st.cx, cy: 0, r: 4, fill: room?.walked ? "#aab8c8" : "none", stroke: "#aab8c8", "stroke-width": 1.5, "pointer-events": "none" }, s);
      }
      label(s, st.cx - 44, 1, hourLabel(st.hour), 10, { fill: DIM });
    }
  }
  const hl = el("g", { "pointer-events": "none" }, g);
  return { z, g, hl, layout, ring: true, length: L, home: [0, 0], offsets: [-L, 0, L] };
}

function buildDocksPlan(svg, index) {
  const layout = docksLayout(index);
  const { hub, bearing, transfer, blister } = layout;
  const g = el("g", { display: "none" }, svg);
  const topY = blister.cy - blister.r - 40;
  const botY = transfer.cy + transfer.h / 2 + 40;

  el("rect", { x: -SX - 70, y: topY, width: 2 * (SX + 70), height: botY - topY, rx: 24, fill: PLATE }, g);
  // spine corridor (from the Blister's base, under the dome and stops), Bearing collar, Hub
  el("rect", { x: -CH, y: blister.cy, width: 2 * CH, height: bearing.cy - blister.cy, fill: CORR }, g);
  el("rect", { x: -BEARING.w / 2, y: bearing.cy - BEARING.h / 2, width: BEARING.w, height: BEARING.h, rx: 6, fill: "#1d2a38", stroke: "#cfe3ff", "stroke-width": 1.4 }, g);
  for (let i = 0; i < 7; i++) {
    el("circle", { cx: -27 + i * 9, cy: bearing.cy - BEARING.h / 2, r: 2.5, fill: "#cfe3ff" }, g);
    el("circle", { cx: -27 + i * 9, cy: bearing.cy + BEARING.h / 2, r: 2.5, fill: "#cfe3ff" }, g);
  }
  label(g, 0, bearing.cy, "The Bearing", 11);
  el("rect", { x: -CH, y: bearing.cy + BEARING.h / 2, width: 2 * CH, height: hub.cy - HUB_R - (bearing.cy + BEARING.h / 2), fill: CORR }, g);
  // passage down to Freight Transfer, under the Hub and its 6 o'clock lift
  const tTop = transfer.cy - transfer.h / 2;
  el("rect", { x: -8, y: hub.cy + HUB_R, width: 16, height: tTop - (hub.cy + HUB_R), fill: PASSAGE }, g);
  el("circle", { cx: hub.cx, cy: hub.cy, r: HUB_R, fill: "#141b24", stroke: "#cfe3ff", "stroke-width": 1.6 }, g);
  label(g, 0, hub.cy - 6, "The Hub", 13);
  label(g, 0, hub.cy + 10, "0 g", 10, { fill: DIM });
  SPOKE_HOURS.forEach((h) => {
    const x = hub.cx + HUB_R * Math.sin(ang(h));
    const y = hub.cy - HUB_R * Math.cos(ang(h));
    el("circle", { cx: x, cy: y, r: 11, fill: "#0e131a", stroke: "#cfd8e3", "stroke-width": 1.8 }, g);
    label(g, x, y + 1, "⇅", 11, { fill: "#cfd8e3" });
    label(g, x * 1.38, hub.cy + (y - hub.cy) * 1.38, `${h || 12}`, 9, { fill: DIM });
  });
  hover(el("circle", { cx: hub.cx, cy: hub.cy, r: HUB_R - 14, fill: "transparent" }, g), hub.room);
  hover(el("rect", { x: -BEARING.w / 2, y: bearing.cy - BEARING.h / 2, width: BEARING.w, height: BEARING.h, fill: "transparent" }, g), bearing.room);

  // Freight Transfer below the Hub
  if (transfer.room) roomBox(g, transfer.room, transfer.cx, transfer.cy, DC.docks, transfer.w, transfer.h);

  // side rooms, port left and starboard right
  for (const b of layout.rooms) {
    const sg = Math.sign(b.cx);
    const inner = b.cx - sg * (b.w / 2);
    el("rect", { x: Math.min(sg * CH, inner), y: b.cy - 8, width: Math.abs(inner - sg * CH), height: 16, fill: PASSAGE }, g);
    roomBox(g, b.room, b.cx, b.cy, DC.docks, b.w, b.h);
  }
  // spine stops
  for (const s of layout.spine) {
    el("circle", { cx: 0, cy: s.cy, r: 4, fill: "#aab8c8" }, g);
    label(g, 0, s.cy + SN / 2, `Spine ${s.n}`, 9, { fill: DIM, transform: `rotate(-90 0 ${s.cy + SN / 2})` });
    hitArea(g, -CH, s.cy - s.h / 2, 2 * CH, s.h, s.room);
  }
  // Blister dome on top
  const bx = blister.cx;
  const dome = `M${bx - blister.r},${blister.cy} A${blister.r},${blister.r} 0 0 1 ${bx + blister.r},${blister.cy} Z`;
  const dm = el("path", { d: dome, fill: "#cfe3ff", "fill-opacity": 0.18, stroke: "#cfe3ff", "stroke-width": 1.6 }, g);
  label(g, 0, blister.cy - blister.r - 16, blister.room?.name ?? "Observation Blister", 11);
  hover(dm, blister.room);
  label(g, -SX - 60, topY + 14, "FORE ▲", 10, { fill: DIM, "text-anchor": "start", "letter-spacing": 1 });

  const hl = el("g", { "pointer-events": "none" }, g);
  return { z: 3, g, hl, layout, ring: false, length: 0, home: [0, hub.cy - 120], offsets: [0] };
}

/** T.I.S.S.'s plans, one per level: the three rings, then the Docks. */
function tissPlans(svg, index) {
  return [...[0, 1, 2].map((z) => buildRingPlan(svg, index, z)), buildDocksPlan(svg, index)];
}

export class DeckView {
  /**
   * @param {HTMLElement} containerEl element the deck fills
   * @param {ReturnType<typeof import("./lib/locate.js").indexStation>} index
   * @param {(svg: SVGElement, index: object) => object[]} [build] another station's plans, one per
   *   level; a plan may carry shape(where) for its highlight
   */
  constructor(containerEl, index, build = tissPlans) {
    const id = `glow-deck-${++instances}`;
    const div = document.createElement("div");
    div.className = "deck";
    Object.assign(div.style, {
      position: "relative",
      width: "100%",
      height: "100%",
      overflow: "hidden",
      background: "#04060c",
      cursor: "grab",
      touchAction: "none",
      transition: "opacity .25s",
    });
    containerEl.appendChild(div);
    this.div = div;

    this.aspect = BASE_H / BASE_W;
    const svg = el("svg", { viewBox: `0 0 ${BASE_W} ${BASE_H}`, preserveAspectRatio: "xMidYMid slice" });
    Object.assign(svg.style, { display: "block", width: "100%", height: "100%" });
    div.appendChild(svg);
    this.svg = svg;
    glowFilter(el("defs", {}, svg), id);
    this.glow = `url(#${id})`;
    stars(el("g", {}, svg), -4000, -3000, 8000, 6000, 1600, 9);

    this.plans = build(svg, index);
    this.level = -1;
    this.key = null; // shapeKey of what is drawn now, so repeated frames change nothing
    this.focus = null; // [x, y] of the highlight, or of the plan's home when there is none
    this.cur = [0, 0, BASE_W, BASE_H];
    this.fit();
    this.show(0);
    this.cur = this.homeView();
    this.apply();

    this.zoom = attachPanZoom(div, () => this.cur, (v) => this.setView(v), { minW: MIN_W, maxW: MAX_W });
    zoomButtons(div, "8px", (f) => {
      if (f) {
        this.zoom(f);
        return;
      }
      const plan = this.plans[this.level];
      if (plan.extent) {
        this.setView(this.homeView());
        return;
      }
      const [fx, fy] = this.focus ?? this.plans[this.level].home;
      const h = BASE_W * this.aspect;
      this.setView([fx - BASE_W / 2, (this.plans[this.level].ring ? fy * 0.5 : fy) - h / 2, BASE_W, h]);
    });
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(() => {
        const measured = this.fit();
        if (measured && this.homePending) {
          this.homePending = false;
          this.setView(this.homeView());
        } else this.setView(this.cur);
      }).observe(div);
    }
  }

  /** Match the viewBox aspect to the container, keeping the centre. Returns whether it measured. */
  fit() {
    const r = this.div.getBoundingClientRect?.();
    if (!r || r.width <= 0 || r.height <= 0) return false;
    this.aspect = r.height / r.width;
    const h = this.cur[2] * this.aspect;
    this.cur = [this.cur[0], this.cur[1] + this.cur[3] / 2 - h / 2, this.cur[2], h];
    return true;
  }

  homeView() {
    const [hx, hy] = this.plans[this.level].home;
    const { extent } = this.plans[this.level];
    const w = extent ? fitWidth(extent, this.aspect) : BASE_W;
    const h = w * this.aspect;
    return [hx - w / 2, hy - h / 2, w, h];
  }

  /** Re-frame the plan for a view that has just become visible. */
  home() {
    // Not measurable yet (hidden panel): re-home once the first real size arrives.
    this.homePending = !this.fit();
    this.setView(this.homeView());
  }

  /** Set the viewBox; rings are periodic, so keep the centre inside one lap. */
  setView(v) {
    this.cur = v;
    this.apply();
  }

  apply() {
    const p = this.plans[this.level];
    if (p?.ring) {
      const cx = this.cur[0] + this.cur[2] / 2;
      const wrapped = ((cx % p.length) + p.length) % p.length;
      if (wrapped !== cx) this.cur = [this.cur[0] + wrapped - cx, ...this.cur.slice(1)];
    }
    this.svg.setAttribute("viewBox", this.cur.map((n) => +n.toFixed(2)).join(" "));
  }

  show(level) {
    this.plans.forEach((p, i) => p.g.setAttribute("display", i === level ? "" : "none"));
    this.level = level;
  }

  drawHighlight(plan, shape) {
    plan.hl.replaceChildren();
    if (!shape) return;
    for (const off of plan.offsets) {
      const g = el("g", { transform: `translate(${off} 0)`, filter: this.glow }, plan.hl);
      const attrs = { fill: HL, "fill-opacity": 0.3, stroke: HL, "stroke-width": 3 };
      let node;
      if (shape.kind === "circle") node = el("circle", { cx: shape.cx, cy: shape.cy, r: shape.r, ...attrs }, g);
      else if (shape.kind === "path") node = el("path", { d: shape.d, ...attrs }, g);
      else node = el("rect", { x: shape.x, y: shape.y, width: shape.width, height: shape.height, rx: shape.rx ?? 4, ...attrs }, g);
      el("animate", { attributeName: "opacity", values: "1;0.55;1", dur: "1.8s", repeatCount: "indefinite" }, node);
    }
  }

  /** Show the plan for where.level and light the player's place; "off" just clears the light. */
  set(where) {
    if (!where || where.kind === "off") {
      if (this.key === "off") return;
      for (const p of this.plans) p.hl.replaceChildren();
      this.focus = null;
      this.key = "off";
      return;
    }
    const level = Number.isInteger(where.level) && where.level >= 0 && where.level < this.plans.length ? where.level : this.level;
    const changed = level !== this.level;
    if (changed) this.show(level);
    const plan = this.plans[level];
    const shape = plan.shape ? plan.shape(where) : highlightShape(plan.layout, where);
    const key = shapeKey(level, shape);
    if (key === this.key) return; // same place as last time: keep the pulse running and the view where the user left it
    this.key = key;
    for (const p of this.plans) if (p !== plan) p.hl.replaceChildren();
    this.drawHighlight(plan, shape);
    if (!shape) {
      this.focus = null;
      if (changed) this.setView(this.homeView());
      return;
    }

    let px = shape.kind === "rect" ? shape.x + shape.width / 2 : shape.cx;
    let py = shape.kind === "rect" ? shape.y + shape.height / 2 : shape.cy;
    const [vx, vy, vw, vh] = this.cur;
    const cx = vx + vw / 2;
    const cy = vy + vh / 2;
    if (plan.ring && !changed) {
      // the plan wraps, so 12:00 sits next to 11:00: take the lap nearest the view
      px += Math.round((cx - px) / plan.length) * plan.length;
    }
    this.focus = [px, py];
    const vyFocus = plan.ring ? py * 0.5 : py;
    const m = plan.margin ?? 0.35; // how far off centre the highlight may sit before the view follows
    if (changed || Math.abs(px - cx) > vw * m || Math.abs(vyFocus - cy) > vh * m) {
      this.setView([px - vw / 2, vyFocus - vh / 2, vw, vh]);
    }
  }

  /** Lower the deck's opacity while the player is off the station. */
  dim(on) {
    this.div.style.opacity = on ? "0.45" : "1";
  }
}

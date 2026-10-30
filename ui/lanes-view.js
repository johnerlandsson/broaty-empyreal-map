// The lanes map: the galaxy's twenty systems over the top band, switched on and off by a ⋈ button
// left of the chart's ◎ (docs/maps/lanes.md). The Shallows a ring of trunks in ring order, the Mid a
// disc inside it with its deep stars nearest the centre, as public as help lanes and help mid make
// them; nothing is placed where the stars are. Drawn on it: the lanes of your system open now, and
// branches you've seen open elsewhere, fading as the sighting ages; each star's relay arcs say its
// contact with the Bank, as far as you know it; a key at the right says the rest.
// Zooms and pans like the chart, the names staying their size as the stars spread. Marks and colours
// are the style guide's §13.5.

import {
  SYSTEMS,
  agoText,
  cleanLanes,
  contactOf,
  contactWords,
  lane,
  laneFix,
  laneName,
  lanePath,
  layout,
  openHere,
  seenOpenElsewhere,
  systemName,
} from "./lib/lanes.js";
import { attachPanZoom, el, glowFilter, pulse, stars, zoomButtons } from "./lib/svg.js";

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

const ZOOM_COL = 40; // the zoom buttons' column at the band's right
const ZOOM_IN = 6; // as far in as six times the fit
const STEPS = 32; // segments a lane's curve is drawn in
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

/** A star's relay arcs: Glass in contact, sparse dots cut off, dashed not known. */
const contactLine = (c, s) =>
  c.state === "in"
    ? { stroke: GLASS, "stroke-width": s.band === "shallows" ? 1.1 : 1.8 }
    : c.state === "out"
      ? { stroke: NAME, "stroke-width": 1.5, "stroke-linecap": "round", "stroke-dasharray": "0.1 3.4" }
      : { stroke: DIM, "stroke-width": 1, "stroke-dasharray": "2 2" };

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
    this.pulse = pulse(el("g", {}, hot));
    this.lit = el("g", {}, this.pulse);

    // the key: a card in the top-left corner, folded to a line or two, unfolded to the lists
    this.unfolded ??= false; // the preview's ?unfold sets it on the prototype
    const card = document.createElement("div");
    card.className = "lanes-card";
    // a press on it is the card's, not the start of a pan
    card.addEventListener("pointerdown", (e) => e.stopPropagation());
    card.addEventListener("click", (e) => {
      if (!e.target.closest("button")) return;
      this.unfolded = !this.unfolded;
      this.draw(Date.now());
    });
    div.appendChild(card);
    this.card = card;
    this.cardHtml = "";

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

  /** The view that fits the map left of the zoom buttons, the ring's names inside the band. */
  fit() {
    const [w, h] = this.size();
    const mapW = Math.max(w - ZOOM_COL, 120);
    const px = Math.max(Math.min((h - 48) / 200, (mapW - 104) / 200), 0.2); // px a unit
    const cx = mapW / 2;
    const cy = h / 2;
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
    const { open, closed, uncharted } = openHere(lanes);
    const elsewhere = seenOpenElsewhere(lanes, t);
    const contact = contactOf(lanes, t);

    const marks = document.createDocumentFragment();
    const lit = document.createDocumentFragment();
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
    // branches seen open elsewhere, fading with the sighting's age, which the folded card leaves
    // written at each one's middle
    const ages = document.createDocumentFragment();
    for (const { lane: l, ago } of elsewhere) {
      el("polyline", { points: points(pathOf(l)), fill: "none", stroke: GLASS, "stroke-width": 1.2, "stroke-dasharray": "2 3", opacity: fade(ago) }, marks);
      if (this.unfolded) continue;
      // along it where it's farthest from a star, so the age doesn't sit on one's name
      // (a name runs sideways, so a star counts as nearer across than along)
      const clear = ([x, y]) => Math.min(...Object.values(at).map(([sx, sy]) => Math.hypot((sx - x) / 2, sy - y)));
      const [x, y] = [0.5, 0.4, 0.6, 0.3, 0.7].map((k) => X(pathOf(l)(k))).reduce((best, p) => (clear(p) > clear(best) + 4 ? p : best));
      const age = agoText(ago).split(" ")[0];
      el("rect", { x: x - age.length * 2.6 - 3, y: y - 6, width: age.length * 5.2 + 6, height: 11, rx: 3, fill: BG, opacity: 0.85 }, ages);
      text(ages, x, y + 3, age, { "text-anchor": "middle", "font-size": 8, fill: GLASS, opacity: Math.max(fade(ago), 0.6) });
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

    // the stars: a dot, relays as a pair of arcs either side saying its contact, a Glass diamond over a
    // settled one, its name outward; beside a star whose contact can change, how old it is, or ? not known
    const reach = new Set(open.map((l) => l.between.find((id) => id !== here)));
    for (const s of SYSTEMS) {
      const [x, y] = at[s.id];
      const r = s.band === "shallows" ? 4 : 3.2;
      if (s.id === here && !tr) el("circle", { cx: x, cy: y, r: r + 4.5, fill: "none", stroke: HL, "stroke-width": 2 }, lit);
      if (s.relay) {
        const rr = r + (s.id === here && !tr ? 7.5 : 3.5); // outside her ring
        for (const sx of [-1, 1]) {
          el("path", { d: `M${x + sx * rr * 0.7},${y - rr * 0.7} A${rr},${rr} 0 0 ${sx > 0 ? 1 : 0} ${x + sx * rr * 0.7},${y + rr * 0.7}`, fill: "none", ...contactLine(contact[s.id], s) }, marks);
        }
        const c = contact[s.id];
        if (!c.fixed && !c.now) {
          const [fx, fy] = s.deep ? [x, y + 14] : [x - Math.cos(LAYOUT.P[s.id].a) * 14, y - Math.sin(LAYOUT.P[s.id].a) * 14];
          const field = c.state === "unknown" ? "?" : agoText(t - c.at * 1000).split(" ")[0];
          el("rect", { x: fx - field.length * 2.6 - 3, y: fy - 6, width: field.length * 5.2 + 6, height: 11, rx: 3, fill: BG, opacity: 0.85 }, ages);
          text(ages, fx, fy + 3, field, { "text-anchor": "middle", "font-size": 8, fill: c.state === "in" ? GLASS : c.state === "out" ? DIM : NAME });
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

    marks.appendChild(ages); // over the stars, so a name never hides one
    this.drawCard(t, { tr, fix, here, open, closed, uncharted, elsewhere, contact });

    this.marks.replaceChildren(marks);
    this.lit.replaceChildren(lit);
  }

  /** The key's card, its HTML replaced only when it changes, so its scroll and its button stay put. */
  drawCard(t, { tr, fix, here, open, closed, uncharted, elsewhere, contact }) {
    const esc = (v) => String(v).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
    const sw = (cls, opacity = 1) => `<span class="sw ${cls}" style="opacity:${opacity}"></span>`;
    const rows = [];
    if (tr && fix) {
      const left = fix.left === null ? "" : `<span class="secs">${span(fix.left)}</span>`;
      rows.push(`<div class="row lane"><span class="label">in the ${esc(systemName(tr.to))} lane <span class="off">· no contact</span></span>${left}</div>`);
    }
    const fold = `<button type="button" title="${this.unfolded ? "Fold" : "Unfold"}">${this.unfolded ? "▾" : "▸"}</button>`;
    if (here) {
      // a count of none is left out, but for open: a new character's are all "not charted"
      const counts = [`${open.length} open`];
      if (closed) counts.push(`${closed} closed`);
      if (uncharted.length) counts.push(`${uncharted.length} not charted`);
      rows.push(`<div class="row"><span class="label">From ${esc(systemName(here))} · ${counts.join(" · ")}</span>${fold}</div>`);
    } else if (elsewhere.length) {
      rows.push(`<div class="row"><span class="label">Lanes</span>${fold}</div>`);
    }
    if (this.unfolded) {
      const list = [`<div class="head first">Contact with Senara</div>`];
      const mark = { in: "●", out: "×", unknown: "?" };
      for (const s of SYSTEMS.filter((x) => !contact[x.id].fixed)) {
        const c = contact[s.id];
        list.push(`<div class="item"><span class="mk">${mark[c.state]}</span>${esc(s.name)}<span class="cls">${esc(contactWords(c, t))}</span></div>`);
      }
      list.push(`<div class="item"><span class="mk">●</span>The Shallows<span class="cls">in contact · always</span></div>`);
      list.push(`<div class="item"><span class="mk">×</span>No relays<span class="cls">cut off · always</span></div>`);
      list.push(`<div class="head">From ${esc(here ? systemName(here) : "here")}</div>`);
      for (const l of open) {
        const cls = l.class === "trunk" ? "trunk" : l.class === "mid" ? "mid" : "branch";
        list.push(`<div class="item">${sw(cls)}${esc(systemName(l.between.find((id) => id !== here)))}<span class="cls">${CLASS[l.class]}</span></div>`);
      }
      if (uncharted.length) {
        // what plot says of them: "past lane mouths you haven't found"
        list.push(`<div class="head">Not charted · scan lanes</div>`);
        for (const l of uncharted) {
          list.push(`<div class="item uncharted">${sw("none")}${esc(systemName(l.between.find((id) => id !== here)))}<span class="cls">${CLASS[l.class]}</span></div>`);
        }
      }
      if (elsewhere.length) {
        list.push(`<div class="head">Seen open elsewhere</div>`);
        for (const { lane: l, ago } of elsewhere) {
          list.push(`<div class="item">${sw("seen", fade(ago))}${esc(laneName(l.id))}<span class="cls">${agoText(ago)} ago</span></div>`);
        }
      }
      if (list.length) rows.push(`<div class="list">${list.join("")}</div>`);
    }
    const html = rows.join("");
    this.card.hidden = !html;
    if (html !== this.cardHtml) {
      const scroll = this.card.querySelector(".list")?.scrollTop ?? 0;
      this.card.innerHTML = html;
      this.cardHtml = html;
      const list = this.card.querySelector(".list");
      if (list) list.scrollTop = scroll;
    }
  }
}

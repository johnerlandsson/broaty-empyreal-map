// Small SVG and pointer helpers for the deck plans. DOM is only touched when these are called.

const NS = "http://www.w3.org/2000/svg";
const PICK_SLOP = 4; // px a press may move and still be a click, not a pan

/** Create an SVG element with attributes, optional parent and optional text. */
export function el(tag, attrs, parent, text) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs ?? {}) e.setAttribute(k, attrs[k]);
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

/** Small seeded generator, so the starfield and portholes are the same on every draw. */
export function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STAR_SHADES = 16; // opacities a starfield is drawn in, a path each: steps of 0.0375 the eye can't tell

/**
 * Scatter n stars over a rectangle, as a path per shade, not an element a star: every pan and zoom
 * repaints them. Each star is a circle of its own radius drawn as two arcs, so they scale with the
 * plan as circles did; only the opacity is rounded, to the middle of its shade.
 */
export function stars(g, x, y, w, h, n, seed) {
  const r = rng(seed);
  const shades = Array.from({ length: STAR_SHADES }, () => []);
  const f = (v) => +v.toFixed(2);
  for (let i = 0; i < n; i++) {
    const cx = x + r() * w;
    const cy = y + r() * h;
    const rad = f(r() * 1.3 + 0.3);
    const shade = Math.floor(r() * STAR_SHADES); // opacity r() * 0.6 + 0.12, rounded
    shades[shade].push(`M${f(cx - rad)} ${f(cy)}a${rad} ${rad} 0 1 0 ${f(rad * 2)} 0a${rad} ${rad} 0 1 0 ${f(-rad * 2)} 0`);
  }
  shades.forEach((d, i) => {
    if (d.length) el("path", { d: d.join(""), fill: "#fff", opacity: +(((i + 0.5) / STAR_SHADES) * 0.6 + 0.12).toFixed(4) }, g);
  });
}

/** A soft glow filter, referenced as url(#id). */
export function glowFilter(defs, id) {
  const f = el("filter", { id, x: "-30%", y: "-30%", width: "160%", height: "160%" }, defs);
  el("feGaussianBlur", { stdDeviation: 4, result: "b" }, f);
  const m = el("feMerge", {}, f);
  el("feMergeNode", { in: "b" }, m);
  el("feMergeNode", { in: "SourceGraphic" }, m);
}

const PULSE_MS = 1800; // one breath: opacity 1 -> .55 -> 1
const PULSE_HZ = 15; // how often it's redrawn: the glow's blur repaints each time, and 15 a second reads smooth

const pulsing = new Map(); // node -> { t0, seen }: when its breath began, and whether it has been on the page
let pulseTimer = 0;

/** Opacity t ms into a breath: down from 1 to .55 and back, in straight lines. */
export function pulseAt(t) {
  const u = (((t % PULSE_MS) + PULSE_MS) % PULSE_MS) / PULSE_MS;
  return +(1 - 0.45 * (1 - Math.abs(1 - 2 * u))).toFixed(3);
}

function pulseTick() {
  if (document.hidden) return;
  const now = performance.now();
  for (const [node, p] of pulsing) {
    if (!node.isConnected) {
      if (p.seen) pulsing.delete(node); // taken off the page (a new place's light): done with
      continue; // not on the page yet: wait for it
    }
    p.seen = true;
    if (!node.getClientRects().length) continue; // in a hidden view: nothing to draw
    node.setAttribute("opacity", pulseAt(now - p.t0));
  }
  if (!pulsing.size) {
    clearInterval(pulseTimer);
    pulseTimer = 0;
  }
}

/**
 * Make node breathe (opacity 1 -> .55 -> 1 over 1.8 s) for as long as it's on the page, or start
 * its breath again from full. Every pulsing node is set by one timer, PULSE_HZ times a second
 * rather than every frame as an SVG <animate> is: each change repaints the glow's blur. A node in
 * a hidden view is left as it is.
 */
export function pulse(node) {
  pulsing.set(node, { t0: performance.now(), seen: node.isConnected });
  node.setAttribute("opacity", 1);
  pulseTimer ||= setInterval(pulseTick, 1000 / PULSE_HZ);
  return node;
}

/**
 * Wheel zoom about the cursor and drag pan on a viewBox held by the caller.
 * @param {HTMLElement} div element the svg fills
 * @param {() => number[]} get current viewBox [x, y, w, h]
 * @param {(vb: number[]) => void} set replace the viewBox
 * @param {{minW: number, maxW: number|(() => number)}} limits the narrowest and widest viewBox; the
 *   widest may be asked each time, for a view whose plans differ
 * @returns {(f: number, ax?: number, ay?: number) => void} zoom by factor f (<1 zooms in)
 */
export function attachPanZoom(div, get, set, { minW, maxW }) {
  const scale = () => {
    const r = div.getBoundingClientRect();
    const v = get();
    return Math.max(v[2] / (r.width || 1), v[3] / (r.height || 1));
  };
  const toView = (cx, cy) => {
    const r = div.getBoundingClientRect();
    const v = get();
    const s = scale();
    return [v[0] + v[2] / 2 + (cx - r.left - r.width / 2) * s, v[1] + v[3] / 2 + (cy - r.top - r.height / 2) * s];
  };
  const zoom = (f, ax, ay) => {
    const v = get();
    if (ax == null) {
      ax = v[0] + v[2] / 2;
      ay = v[1] + v[3] / 2;
    }
    const k = Math.max(minW, Math.min(typeof maxW === "function" ? maxW() : maxW, v[2] * f)) / v[2];
    set([ax - (ax - v[0]) * k, ay - (ay - v[1]) * k, v[2] * k, v[3] * k]);
  };
  div.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      zoom(Math.exp(e.deltaY * 0.0015), ...toView(e.clientX, e.clientY));
    },
    { passive: false },
  );
  // A press must not start WebKit's own drag of the SVG (an image ghost follows the pointer, and
  // the webview swallows the release, so the pan never lets go) or a text selection: Tauri's
  // webview handles native drag badly (Mallard's docs/tauri-webview-quirks.md).
  Object.assign(div.style, { userSelect: "none", webkitUserSelect: "none", webkitUserDrag: "none" });
  const block = (e) => e.preventDefault();
  div.addEventListener("selectstart", block);
  let drag = null;
  const end = () => {
    drag = null;
  };
  div.addEventListener("dragstart", (e) => {
    e.preventDefault();
    end();
  });
  div.addEventListener("pointerdown", (e) => {
    if (e.target.closest?.(".zoom")) return;
    if (e.button !== 0) return; // a right-click's release goes to the context menu, not here
    e.preventDefault();
    drag = [e.clientX, e.clientY];
    div.setPointerCapture?.(e.pointerId);
  });
  div.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (!(e.buttons & 1)) return end(); // released where we didn't hear it
    const s = scale();
    const v = get();
    set([v[0] - (e.clientX - drag[0]) * s, v[1] - (e.clientY - drag[1]) * s, v[2], v[3]]);
    drag = [e.clientX, e.clientY];
  });
  div.addEventListener("pointerup", end);
  div.addEventListener("pointercancel", end);
  div.addEventListener("lostpointercapture", end);
  return zoom;
}

/**
 * Picking, for the tweak editor: a click on an element with data-room (a press and release within
 * PICK_SLOP px, so never the end of a pan) calls pick(id). It listens beside attachPanZoom's own
 * handlers and takes the room from the press, as the pan's pointer capture sends the release to div.
 * @param {HTMLElement} div element the svg fills
 * @param {(id: string) => void} pick
 */
export function attachPick(div, pick) {
  let down = null;
  const far = (e) => Math.hypot(e.clientX - down.x, e.clientY - down.y) > PICK_SLOP;
  div.addEventListener("pointerdown", (e) => {
    const node = e.button === 0 ? e.target.closest?.("[data-room]") : null;
    down = node ? { x: e.clientX, y: e.clientY, id: node.getAttribute("data-room") } : null;
  });
  div.addEventListener("pointermove", (e) => {
    if (down && far(e)) down = null;
  });
  div.addEventListener("pointerup", (e) => {
    const hit = down && !far(e) ? down.id : null;
    down = null;
    if (hit) pick(hit);
  });
  div.addEventListener("pointercancel", () => {
    down = null;
  });
}

/** + (zoom in), - (zoom out) and a reset button; onZoom(f) gets 1/1.5, 1.5 or 0 for reset. */
export function zoomButtons(container, top, onZoom) {
  const z = document.createElement("div");
  z.className = "zoom";
  Object.assign(z.style, { position: "absolute", right: "8px", top, display: "flex", flexDirection: "column", gap: "3px", zIndex: "2" });
  [
    ["+", 1 / 1.5, "Zoom in"],
    ["−", 1.5, "Zoom out"],
    ["⌂", 0, "Reset view"],
  ].forEach(([label, f, title]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.title = title;
    Object.assign(b.style, {
      width: "24px",
      height: "24px",
      borderRadius: "5px",
      border: "1px solid var(--fg-muted, #7d8a9a)",
      background: "var(--bg, #04060c)", // solid fallback; the translucent form below needs color-mix
      color: "var(--fg, #dfe7f1)",
      fontSize: "14px",
      lineHeight: "1",
      cursor: "pointer",
      padding: "0",
    });
    b.style.background = "color-mix(in srgb, var(--bg, #04060c) 70%, transparent)"; // ignored where unsupported
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      onZoom(f);
    });
    z.appendChild(b);
  });
  container.appendChild(z);
  return z;
}

/** A target's four corner brackets round (x, y), half-width r, each arm k long (px). */
export function brackets(x, y, r, k) {
  return [
    `M${x - r},${y - r + k} V${y - r} H${x - r + k}`,
    `M${x + r - k},${y - r} H${x + r} V${y - r + k}`,
    `M${x + r},${y + r - k} V${y + r} H${x + r - k}`,
    `M${x - r + k},${y + r} H${x - r} V${y + r - k}`,
  ].join(" ");
}

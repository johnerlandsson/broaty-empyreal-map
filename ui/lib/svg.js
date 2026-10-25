// Small SVG and pointer helpers for the deck plans. DOM is only touched when these are called.

const NS = "http://www.w3.org/2000/svg";

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

/** Scatter n stars over a rectangle. */
export function stars(g, x, y, w, h, n, seed) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    el("circle", { cx: x + r() * w, cy: y + r() * h, r: r() * 1.3 + 0.3, fill: "#fff", opacity: r() * 0.6 + 0.12 }, g);
  }
}

/** A soft glow filter, referenced as url(#id). */
export function glowFilter(defs, id) {
  const f = el("filter", { id, x: "-30%", y: "-30%", width: "160%", height: "160%" }, defs);
  el("feGaussianBlur", { stdDeviation: 4, result: "b" }, f);
  const m = el("feMerge", {}, f);
  el("feMergeNode", { in: "b" }, m);
  el("feMergeNode", { in: "SourceGraphic" }, m);
}

/**
 * Wheel zoom about the cursor and drag pan on a viewBox held by the caller.
 * @param {HTMLElement} div element the svg fills
 * @param {() => number[]} get current viewBox [x, y, w, h]
 * @param {(vb: number[]) => void} set replace the viewBox
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
    const k = Math.max(minW, Math.min(maxW, v[2] * f)) / v[2];
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

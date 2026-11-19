// Leaving the page alone when a redraw changes nothing you'd see. The chart, the lanes and belt maps
// and a port's sky are drawn again every second, parked or not, though from one second to the next
// their marks drift by well under a pixel and an "ago" changes once a minute. Putting hundreds of
// fresh SVG nodes in with replaceChildren makes WebKit restyle, lay out and repaint the whole band,
// the starfield and the blurred lit layer with it. So a view builds what it would draw, off the page,
// and hands it to putIn(), which walks it beside what's on the page:
//   - the same (every tag, text and attribute, numbers within half a px): nothing is touched;
//   - the same but for numbers that moved further: just those attributes are set on the page's nodes;
//   - anything else (a mark more or fewer, a text, a colour): the layer's nodes are replaced.
// What's on the page is what was last put in, so drift is measured from where a mark is drawn and
// can't pile up.
// An element with a `data-same` attribute is compared by its tag and attributes alone, not its
// children: a view puts a stand-in with the same `data-same` in its fresh draw for a node it keeps
// and reuses (the sky's starfield), and swaps the kept node in, through `keep`, when the layer is replaced.

// Attributes whose numbers are lengths in user units, allowed to drift; every other attribute, and
// all text, must be the same. A transform's lengths are its translate()'s and a rotate()'s centre.
const LENGTHS = new Set(["x", "y", "cx", "cy", "r", "rx", "ry", "x1", "y1", "x2", "y2", "width", "height", "d", "points", "stroke-dashoffset"]);
const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;
// a rotate()'s angle may drift as much as turns a point this many user units out by the leeway
const TURN_REACH = 600;

/** A value's numbers; and the words round them, each number a #. */
const numbers = (v) => (v.match(NUMBER) ?? []).map(Number);
const words = (v) => v.replace(NUMBER, "#");

/** Whether two values of attribute `name` draw the same, give or take `within` units. */
export function sameValue(name, a, b, within) {
  if (a === b) return true;
  if (name === "transform") return sameTransform(a, b, within);
  if (!LENGTHS.has(name) || words(a) !== words(b)) return false;
  const p = numbers(a);
  const q = numbers(b);
  return p.every((n, i) => Math.abs(n - q[i]) < within);
}

function sameTransform(a, b, within) {
  const parts = (v) => [...v.matchAll(/(\w+)\(([^)]*)\)/g)].map(([, fn, args]) => [fn, numbers(args)]);
  const p = parts(a);
  const q = parts(b);
  if (p.length !== q.length || words(a) !== words(b)) return false;
  const turn = ((within / TURN_REACH) * 180) / Math.PI; // degrees
  return p.every(([fn, x], i) => {
    const y = q[i][1];
    if (fn === "translate") return x.every((n, k) => Math.abs(n - y[k]) < within);
    if (fn === "rotate") return x.every((n, k) => Math.abs(n - y[k]) < (k === 0 ? turn : within));
    return x.every((n, k) => n === y[k]); // scale(), matrix(): exactly
  });
}

/**
 * Walk the fresh node beside the page's, adding [node, name, value] for each attribute to set on
 * the page's to `sets`; false when they differ in more than numbers that drift.
 */
function walk(fresh, page, within, sets) {
  if (fresh.nodeType !== page.nodeType) return false;
  if (fresh.nodeType === 3) return fresh.data === page.data;
  if (fresh.nodeType !== 1) return true;
  if (fresh.localName !== page.localName) return false;
  const fa = fresh.attributes;
  const pa = page.attributes;
  if (fa.length !== pa.length) return false;
  for (let i = 0; i < fa.length; i++) {
    const { name, value } = fa[i];
    if (pa[i].name !== name) return false;
    if (value === pa[i].value) continue;
    if (name === "data-same") return false;
    if (sameValue(name, value, pa[i].value, within)) continue;
    if (!LENGTHS.has(name) && name !== "transform") return false;
    if (words(value) !== words(pa[i].value)) return false;
    sets.push([page, name, value]); // moved: set on the node that's on the page
  }
  return fresh.hasAttribute("data-same") || children(fresh, page, within, sets);
}

function children(fresh, page, within, sets) {
  if (fresh.childNodes.length !== page.childNodes.length) return false;
  for (let f = fresh.firstChild, p = page.firstChild; f; f = f.nextSibling, p = p.nextSibling) {
    if (!walk(f, p, within, sets)) return false;
  }
  return true;
}

/**
 * Put each fresh draw (a fragment) in its layer on the page (an element) as the module's header
 * says. `keep` swaps a kept node in for its stand-in, `data-same` -> node. Returns "same",
 * "patched" or "replaced".
 */
export function putIn(fresh, layers, { within = 0.5, keep = null } = {}) {
  const sets = [];
  const same = fresh.every((f, i) => children(f, layers[i], within, sets));
  if (same) {
    for (const [node, name, value] of sets) node.setAttribute(name, value);
    return sets.length ? "patched" : "same";
  }
  fresh.forEach((f, i) => {
    if (keep) for (const stand of f.querySelectorAll("[data-same]")) stand.replaceWith(keep.get(stand.getAttribute("data-same")) ?? stand);
    layers[i].replaceChildren(f);
  });
  return "replaced";
}

/** Set the attribute only when its value changes: setting it at all can make WebKit repaint. */
export function setAttr(node, name, value) {
  const v = String(value);
  if (node.getAttribute(name) !== v) node.setAttribute(name, v);
}

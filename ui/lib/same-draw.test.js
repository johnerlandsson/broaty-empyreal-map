// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { putIn, sameValue, setAttr } from "./same-draw.js";
import { el } from "./svg.js";

const frag = (...build) => {
  const f = document.createDocumentFragment();
  for (const b of build) b(f);
  return f;
};
const circle = (cx, attrs = {}) => (f) => el("circle", { cx, cy: 20, r: 3, fill: "#fff", ...attrs }, f);
const label = (x, text, attrs = {}) => (f) => el("text", { x, y: 30, "text-anchor": "start", ...attrs }, f, text);

/** A layer on the page with this drawn in it. */
function page(...build) {
  const layer = el("g");
  layer.appendChild(frag(...build));
  return layer;
}

describe("sameValue", () => {
  it("lets lengths drift by less than the leeway, every number of a path", () => {
    expect(sameValue("cx", "80.24", "80.26", 0.5)).toBe(true); // no rounding edge between them
    expect(sameValue("cx", "10", "10.5", 0.5)).toBe(false);
    expect(sameValue("d", "M10.2,-4.9 A3,3 0 0 1 7.74,1e-3 Z", "M10.4,-4.8 A3,3 0 0 1 7.6,0 Z", 0.5)).toBe(true);
    expect(sameValue("d", "M10,0 A3,3 0 0 1 7,0 Z", "M10,0 A3,3 0 1 1 7,0 Z", 0.5)).toBe(false); // an arc's flag
    expect(sameValue("d", "M10,0 L7,0", "M10,0 H7", 0.5)).toBe(false);
  });

  it("wants anything else the same: opacity, colour, font size", () => {
    expect(sameValue("opacity", "0.55", "0.56", 0.5)).toBe(false);
    expect(sameValue("font-size", "9", "9.2", 0.5)).toBe(false);
  });

  it("lets a transform's lengths drift, its angle only as far as turns a point 600 out by the leeway, its scale not at all", () => {
    expect(sameValue("transform", "translate(12.3 4.1) rotate(-33.6)", "translate(12.5 4.3) rotate(-33.62)", 0.5)).toBe(true);
    expect(sameValue("transform", "rotate(10 100 50)", "rotate(10.4 100 50)", 0.5)).toBe(false); // 0.4° moves an end 400 px out 3 px
    expect(sameValue("transform", "rotate(10 100 50)", "rotate(10 100.3 50.2)", 0.5)).toBe(true);
    expect(sameValue("transform", "translate(1 1) scale(1)", "translate(1 1) scale(1.4)", 0.5)).toBe(false);
  });
});

describe("putIn", () => {
  it("leaves the page alone for marks moved by less than the leeway", () => {
    const layer = page(circle(10.24), label(40.02, "Gannet"));
    const before = [...layer.childNodes];
    expect(putIn([frag(circle(10.26), label(40.4, "Gannet"))], [layer])).toBe("same");
    expect([...layer.childNodes]).toEqual(before);
    expect(layer.firstChild.getAttribute("cx")).toBe("10.24"); // still where it was drawn: drift is from there
  });

  it("sets just the numbers that moved further on the page's nodes", () => {
    const layer = page(circle(10), label(40, "Gannet"));
    const [c, t] = layer.childNodes;
    expect(putIn([frag(circle(10.8), label(40.1, "Gannet"))], [layer])).toBe("patched");
    expect([...layer.childNodes]).toEqual([c, t]);
    expect(c.getAttribute("cx")).toBe("10.8");
    expect(t.getAttribute("x")).toBe("40"); // within the leeway: untouched
  });

  it("replaces a layer whose text, colour, anchor or marks change", () => {
    for (const next of [
      frag(circle(10), label(40, "seen 3 min ago")),
      frag(circle(10, { fill: "#000" }), label(40, "seen 2 min ago")),
      frag(circle(10), label(40, "seen 2 min ago", { "text-anchor": "end" })),
      frag(circle(10)),
      frag((f) => circle(10)(el("g", {}, f)), label(40, "seen 2 min ago")),
    ]) {
      const layer = page(circle(10), label(40, "seen 2 min ago"));
      const want = el("g");
      want.appendChild(next.cloneNode(true));
      expect(putIn([next], [layer])).toBe("replaced");
      expect(layer.innerHTML).toBe(want.innerHTML);
    }
  });

  it("puts nothing in where both are empty, and the first draw in", () => {
    const layer = el("g");
    expect(putIn([frag()], [layer])).toBe("same");
    expect(putIn([frag(circle(10))], [layer])).toBe("replaced");
    expect(layer.childNodes.length).toBe(1);
  });

  it("compares a data-same node by its attributes alone, and swaps the kept one in for its stand-in", () => {
    const stars = el("g", { "data-same": "stars-25" });
    el("path", { d: "M1,1" }, stars);
    const keep = new Map([["stars-25", stars]]);
    const stand = () => (f) => el("g", { "data-same": "stars-25" }, f);
    const layer = el("g");
    expect(putIn([frag(stand(), circle(10))], [layer], { keep })).toBe("replaced");
    expect(layer.firstChild).toBe(stars);
    expect(putIn([frag(stand(), circle(10))], [layer], { keep })).toBe("same");
    expect(putIn([frag(stand(), circle(20))], [layer], { keep })).toBe("patched");
    expect(layer.firstChild).toBe(stars);
    expect(putIn([frag(stand(), label(1, "W"))], [layer], { keep })).toBe("replaced");
    expect(layer.firstChild).toBe(stars);
  });
});

describe("setAttr", () => {
  it("sets an attribute only when its value changes", () => {
    const node = el("ellipse", { cx: 1 });
    let sets = 0;
    const set = node.setAttribute.bind(node);
    node.setAttribute = (k, v) => (sets++, set(k, v));
    setAttr(node, "cx", 1);
    expect(sets).toBe(0);
    setAttr(node, "cx", 2);
    expect(node.getAttribute("cx")).toBe("2");
    expect(sets).toBe(1);
  });
});

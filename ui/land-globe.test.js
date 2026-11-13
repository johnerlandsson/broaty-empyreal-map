// @vitest-environment happy-dom
// The top band while you walk the land (spec, "The top band"): Tamsin from above as a whole
// low-poly globe on the stars, your spot lit amber and the only thing that glows, and no text.

import { describe, expect, it } from "vitest";
import sky from "./data/sky.js";
import { LandGlobe } from "./land-globe.js";

function make() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  return { host, globe: new LandGlobe(host, { latitude: sky.zennor.latitude }) };
}

const glowing = (root) => [...root.querySelectorAll("[filter]")];
const spotAt = (root) => {
  const [spot] = glowing(root);
  return [+spot.getAttribute("cx"), +spot.getAttribute("cy")];
};

describe("LandGlobe", () => {
  it("draws one glowing spot, amber with a 2.4 px ring", () => {
    const { globe } = make();
    globe.set({ x: 0, y: 0 });
    const spots = glowing(globe.div);
    expect(spots).toHaveLength(1);
    expect(spots[0].getAttribute("stroke")).toBe("#ffb347");
    expect(spots[0].getAttribute("stroke-width")).toBe("2.4");
  });

  it("has no text", () => {
    const { globe } = make();
    globe.set({ x: 3, y: -2 });
    expect(globe.div.querySelectorAll("text")).toHaveLength(0);
  });

  it("draws the same facets on two builds", () => {
    const facets = (g) => [...g.div.querySelectorAll("polygon")].map((p) => `${p.getAttribute("points")} ${p.getAttribute("fill")}`);
    const a = facets(make().globe);
    expect(a.length).toBeGreaterThan(100);
    expect(facets(make().globe)).toEqual(a);
  });

  it("has sea on some facets and ground on most", () => {
    const fills = [...make().globe.div.querySelectorAll("polygon")].map((p) => p.getAttribute("fill"));
    const blue = fills.filter((f) => {
      const [r, , b] = [1, 3, 5].map((i) => parseInt(f.slice(i, i + 2), 16));
      return b > r;
    });
    expect(blue.length / fills.length).toBeGreaterThan(0.08);
    expect(blue.length / fills.length).toBeLessThan(0.25);
  });

  it("puts your spot a little north of the globe's middle", () => {
    const { globe } = make();
    globe.set({ x: 0, y: 0 });
    const disc = globe.div.querySelector("[data-globe]");
    const [cx, cy] = [+disc.getAttribute("cx"), +disc.getAttribute("cy")];
    const r = +disc.getAttribute("r");
    const [x, y] = spotAt(globe.div);
    expect(Math.abs(x - cx)).toBeLessThan(2);
    expect(cy - y).toBeGreaterThan(r * 0.1);
    expect(cy - y).toBeLessThan(r * 0.4);
  });

  it("moves the spot by less than 2 px for 30 km", () => {
    const { globe } = make();
    globe.set({ x: 0, y: 0 });
    const [x0, y0] = spotAt(globe.div);
    globe.set({ x: 30, y: 0 });
    const [x1, y1] = spotAt(globe.div);
    expect(x1).toBeGreaterThan(x0);
    expect(Math.hypot(x1 - x0, y1 - y0)).toBeLessThan(2);
  });

  it("shows and hides", () => {
    const { host, globe } = make();
    expect(host.contains(globe.div)).toBe(true);
    globe.show(false);
    expect(globe.div.style.display).toBe("none");
    globe.show(true);
    expect(globe.div.style.display).not.toBe("none");
  });
});

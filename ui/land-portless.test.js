// @vitest-environment happy-dom
// The walked land's board and globe away from Tamsin's Zennor (empyreal docs/all-worlds.md,
// docs/set-pieces.md): a world with no port draws no town and no way home to one; Orrin's town is
// Dolcoath, not Zennor; a site's room keeps the land's board up; places across a world's seam sit
// side by side; and the globe keeps your spot in sight anywhere on the world.

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import land from "./data/land.js";
import sky from "./data/sky.js";
import { LandDeck } from "./land-deck.js";
import { LandGlobe } from "./land-globe.js";
import { landWorld, siteLand, townName } from "./lib/land-choose.js";
import { LandStore } from "./lib/land-store.js";

beforeAll(() => vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] }));
afterAll(() => vi.useRealTimers());
afterEach(() => document.body.replaceChildren());

function deckFor(area) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const deck = new LandDeck(host, landWorld(area, land), area.slice("surface.".length));
  deck.div.getBoundingClientRect = () => ({ left: 0, top: 0, width: 520, height: 400, right: 520, bottom: 400 });
  return deck;
}
const press = (node, type, at = {}) => node.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, buttons: 1, clientX: 10, clientY: 10, ...at }));
const click = (node) => {
  press(node, "pointerdown");
  press(node, "pointerup", { buttons: 0 });
};
const octOf = (deck, id) => deck.svg.querySelector(`[data-place="${id}"] use`);
const texts = (deck) => [...deck.svg.querySelectorAll("text")].map((t) => t.textContent);

// Lanyon, no port: coords km from 0° N 0° E, round the world at 2π·6400 km
const WRAP = 40212.4;
const P1 = "surface.lanyon.412.977.1", P2 = "surface.lanyon.412.977.2";
const FRONT = "surface.lanyon.site.lark", HULL = "site.lark.hull", HOLD = "site.lark.hold";
const place = (id, x, y, exits, name = "Bare Rock") => ({ id, name, area: "surface.lanyon", terrain: "rock", coords: { x, y, z: 0 }, wrap: WRAP, exits });
const room = (id, name, exits) => ({ id, name, area: "site.lark", site: "lark", exits });

function lanyonWalk() {
  const s = new LandStore();
  s.ingest(place(P1, 352.6, 3095.3, { E: { id: P2, inverse: "W" }, W: { id: FRONT, inverse: "E" } }));
  s.ingest(place(P2, 354.2, 3095.5, { W: { id: P1, inverse: "E" } }));
  return s;
}
function siteWalk() {
  const s = lanyonWalk();
  s.ingest(place(FRONT, 351.1, 3095.3, { E: { id: P1, inverse: "W" }, N: { id: HULL, area: "site.lark", inverse: "S" } }, "The Lark"));
  s.ingest(room(HULL, "Inside the Hull", { S: { id: FRONT, area: "surface.lanyon", inverse: "N" }, E: { id: HOLD, inverse: "W" } }));
  s.ingest(room(HOLD, "The Hold", { W: { id: HULL, inverse: "E" } }));
  return s;
}

describe("the board on a world with no port", () => {
  it("draws the walked places and no town, its name or roads", () => {
    const deck = deckFor("surface.lanyon");
    deck.draw(lanyonWalk());
    expect(octOf(deck, P1)).toBeTruthy();
    expect(octOf(deck, P2)).toBeTruthy();
    expect(deck.svg.querySelector("[data-zennor]")).toBe(null);
    expect(texts(deck)).toEqual([]);
  });

  it("puts no way-home card on the edge, however far you look", () => {
    const deck = deckFor("surface.lanyon");
    deck.draw(lanyonWalk());
    deck.home();
    deck.centre(0, 0, 26);
    expect(deck.div.querySelector(".land-edge")).toBe(null);
  });

  it("centres on you, a few thousand km from where the land's measured from", () => {
    const deck = deckFor("surface.lanyon");
    deck.draw(lanyonWalk());
    const [x, y, w, h] = deck.svg.getAttribute("viewBox").split(" ").map(Number);
    expect(x + w / 2).toBeCloseTo(354.2 * 1.3, 1);
    expect(y + h / 2).toBeCloseTo(-3095.5 * 1.3, 1);
  });
});

describe("Orrin's town", () => {
  it("is named for the port its land is measured from", () => {
    expect(townName(land.tamsin)).toBe("Zennor");
    expect(townName(land.orrin)).toBe("Dolcoath");
    expect(townName({ town: [], joins: {} })).toBe(null);
  });

  it("is drawn as DOLCOATH, and its edge card says ← Dolcoath", () => {
    const END = "surface.orrin.join.haul-road";
    const A = "surface.orrin.100.200.1";
    const s = new LandStore();
    s.ingest({ id: END, name: "Head of the Haul Road", area: "surface.orrin", coords: { x: 3, y: 0 }, exits: { w: { id: "dolcoath.haul-road", area: "dolcoath" }, e: { id: A, inverse: "w" } } });
    s.ingest({ id: A, name: "Ice Field", area: "surface.orrin", coords: { x: 4.4, y: 0 }, exits: { w: { id: END, inverse: "e" } } });
    const deck = deckFor("surface.orrin");
    deck.draw(s);
    expect(texts(deck)).toContain("DOLCOATH");
    expect(texts(deck)).not.toContain("ZENNOR");
    deck.centre(60, 0, 26);
    expect(deck.div.querySelector(".land-edge").textContent).toBe("← Dolcoath");
  });
});

describe("in a site's room", () => {
  it("is shown on the land of the site's walked front", () => {
    const s = siteWalk();
    expect(siteLand("site.lark", s)).toBe("surface.lanyon");
    expect(siteLand("site.nowhere", s)).toBe(null);
    expect(siteLand("surface.lanyon", s)).toBe(null);
    expect(siteLand(undefined, s)).toBe(null);
  });

  it("keeps the board, centred on your room by the front you went in by, lit there and not on the front", () => {
    const deck = deckFor("surface.lanyon");
    deck.draw(siteWalk());
    const hold = deck.L.rooms.get(HOLD);
    expect(deck.focus).toEqual([hold.x, -hold.y]);
    expect(octOf(deck, FRONT)).toBeTruthy();
    const lit = deck.svg.querySelectorAll("[data-here]");
    expect(lit).toHaveLength(1);
    expect(lit[0].getAttribute("data-here")).toBe(HOLD);
    expect(lit[0].tagName.toLowerCase()).toBe("rect");
    expect(lit[0].getAttribute("filter")).toMatch(/^url\(#glow-land-\d+\)$/);
    expect(+lit[0].getAttribute("x") + 0.25).toBeCloseTo(hold.x, 4);
    expect(deck.svg.querySelectorAll("[data-lit]")).toHaveLength(0); // no ways out of a room
  });

  it("draws each room entered as a roofed square, its doors, and a bar for a door not gone through", () => {
    const s = siteWalk();
    s.ingest(place(FRONT, 351.1, 3095.3, { E: { id: P1, inverse: "W" }, N: { id: HULL, area: "site.lark", inverse: "S" }, S: { id: "site.lark.deck", area: "site.lark" } }, "The Lark"));
    const deck = deckFor("surface.lanyon");
    deck.draw(s);
    const rooms = [...deck.svg.querySelectorAll("[data-room]")];
    expect(rooms.map((r) => r.getAttribute("data-room")).sort()).toEqual([HOLD, HULL].sort());
    for (const r of rooms) {
      expect(r.getAttribute("data-pick")).toBe(r.getAttribute("data-room"));
      expect(r.getAttribute("stroke")).toBe("#4b4338");
      expect(r.getAttribute("vector-effect")).toBe("non-scaling-stroke");
      expect(+r.getAttribute("width")).toBeCloseTo(0.5, 6);
    }
    expect(deck.svg.querySelectorAll("[data-door]")).toHaveLength(2);
    expect(deck.svg.querySelectorAll("[data-door-bar]")).toHaveLength(1);
    // nothing names the room not entered
    expect(deck.div.textContent).not.toMatch(/deck/i);
  });

  it("shows a room's name on hover, and takes a click on it as a place to go to", () => {
    const shown = [];
    window.panel = { tooltip: { show: (_r, t) => shown.push(t), hide: () => {} } };
    const s = siteWalk();
    s.ingest(place(P2, 354.2, 3095.5, { W: { id: P1, inverse: "E" } }));
    const deck = deckFor("surface.lanyon");
    deck.draw(s);
    const hull = deck.svg.querySelector(`[data-room="${HULL}"]`);
    hull.dispatchEvent(new MouseEvent("mouseenter"));
    expect(shown.at(-1)).toEqual({ title: "Inside the Hull", body: "" });
    delete window.panel;
    // from P2, out on the land, to the hull
    s.ingest(place(P2, 354.2, 3095.5, { W: { id: P1, inverse: "E" } }));
    deck.draw(s);
    click(hull);
    expect(deck.target).toBe(HULL);
    expect(deck.div.querySelector(".land-card").textContent).toContain("Inside the Hull");
    expect(deck.div.querySelector(".land-card").textContent).toContain("3 steps the way you know");
    expect(deck.svg.querySelector("[data-target]").getAttribute("data-target")).toBe(HULL);
  });

  it("gives a room the ground's menu, with no note", () => {
    const deck = deckFor("surface.lanyon");
    deck.draw(siteWalk());
    deck.svg.querySelector(`[data-room="${HULL}"]`).dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 30, clientY: 40 }));
    const items = [...deck.div.querySelectorAll(".land-menu button")].map((b) => b.textContent);
    expect(items).toEqual(["Forget this land…"]);
  });

  it("lights the way out over the land from your room to a place you click, and counts every step", () => {
    const deck = deckFor("surface.lanyon");
    const s = siteWalk();
    deck.draw(s);
    click(deck.svg.querySelector(`[data-place="${P2}"]`));
    expect(deck.target).toBe(P2);
    expect(deck.svg.querySelectorAll("[data-route]")).toHaveLength(1);
    expect(deck.div.querySelector(".land-card").textContent).toContain("4 steps the way you know");
  });
});

describe("the board across a world's seam", () => {
  it("draws the places either side of it side by side", () => {
    const C1 = "surface.carrow.88.0.1", C2 = "surface.carrow.88.0.2";
    const wrap = 39584.1;
    const s = new LandStore();
    s.ingest({ id: C1, name: "Dust Plain", area: "surface.carrow", coords: { x: 19790.9, y: -2120.4 }, wrap, exits: { e: { id: C2, inverse: "w" } } });
    s.ingest({ id: C2, name: "Dust Plain", area: "surface.carrow", coords: { x: -19791.5, y: -2120.4 }, wrap, exits: { w: { id: C1, inverse: "e" } } });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const deck = new LandDeck(host, landWorld("surface.carrow", land), "carrow");
    deck.draw(s);
    const at = (id) => +/translate\((-?[\d.]+)/.exec(deck.svg.querySelector(`[data-place="${id}"]`).getAttribute("transform"))[1];
    expect(at(C1) - at(C2)).toBeCloseTo(-1.3 * 1.7, 1); // C2 is 1.7 km east, not a world west
  });
});

describe("the globe away from the port", () => {
  const spotAt = (globe) => {
    const spot = globe.div.querySelector("[filter]");
    return [+spot.getAttribute("cx"), +spot.getAttribute("cy")];
  };
  function make(latitude) {
    const host = document.createElement("div");
    document.body.appendChild(host);
    return new LandGlobe(host, { latitude, body: "lanyon" });
  }

  it("is turned to you on a world with no port, so your spot sits a little north of the middle", () => {
    const globe = make(0);
    globe.set({ x: 0, y: 0 });
    const home = spotAt(globe);
    for (const at of [{ x: 352.6, y: 3095.3 }, { x: 11402.3, y: -7561.8 }, { x: -19791.5, y: -2120.4 }]) {
      globe.set(at);
      expect(spotAt(globe)).toEqual(home);
    }
  });

  it("is turned to you when you've landed far from the port on a world with one", () => {
    const globe = make(sky.zennor.latitude);
    globe.set({ x: 0, y: 0 });
    const home = spotAt(globe);
    globe.set({ x: -19000, y: -7000 }); // Tamsin's far side, where a site stands
    expect(spotAt(globe)).toEqual(home);
    globe.set({ x: 30, y: 0 }); // round the port it still moves, a little
    expect(spotAt(globe)[0]).toBeGreaterThan(home[0]);
  });
});

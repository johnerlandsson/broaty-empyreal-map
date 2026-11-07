// @vitest-environment happy-dom
// Dolcoath's top band (reference/dolcoath-overview-options.png, pick C): underground, the section
// through its shaft, your level lit and the cage where Empyreal.Vehicle puts it while you ride it,
// with zoom and ⌂; out of doors in the Pit, the sky over it with the Pit's rim round it.

import { describe, expect, it } from "vitest";
import dolcoath from "../tests/fixtures/generated/dolcoath.js";
import { buildPlace } from "./place-views.js";
import { SectionView } from "./section-view.js";
import { SkyView } from "./town-view.js";

const div = () => document.createElement("div");
const place = () => buildPlace(dolcoath, "levels", div(), div());
const at = (p, roomId, extra = {}) => {
  const msg = { roomId: roomId && `dolcoath.${roomId}`, ...extra };
  const where = p.locate(p.index, msg);
  p.model.set(where, msg);
  return where;
};
const stops = (p) => p.index.cars[0].stops.map((id) => ({ id }));
const cage = (p, lift) => at(p, null, { lift: { id: "dolcoath.cage", kind: "cage", floors: stops(p), ...lift } });
const hot = (p) => [...p.model.section.hot.querySelectorAll("text")].map((t) => t.textContent);

describe("Dolcoath's section", () => {
  it("names every level down the shaft, top to bottom, with its depth", () => {
    const { model } = place();
    expect(model.section).toBeInstanceOf(SectionView);
    const names = [...model.section.base.querySelectorAll("[data-tip^=level] text")].map((t) => t.textContent);
    expect(names).toEqual(["THE PIT", "TWENTY FATHOM", "20 FM", "FORTY FATHOM", "40 FM", "THE TOWN", "80 FM", "THE SMELTS", "120 FM", "THE WORKINGS", "160 FM", "PUMP GALLERY", "THE BOTTOM OF THE WINZE", "200 FM"]);
  });

  it("lights the level you're on, and nothing off the plan", () => {
    const p = place();
    expect(hot(p)).toEqual([]);
    at(p, "bal-cross");
    expect(hot(p)).toEqual(["THE TOWN"]);
    at(p, "pump-gallery");
    expect(hot(p)).toEqual(["PUMP GALLERY"]);
    at(p, null); // aboard your ship on the field
    expect(hot(p)).toEqual([]);
  });

  it("draws the cage only while you ride it, lit in place of a level, pointing the way it's going", () => {
    const p = place();
    at(p, "bal-cross");
    expect(p.model.section.hot.querySelector("[data-tip=cage]")).toBeNull();
    cage(p, { between: ["dolcoath.town-station", "dolcoath.smelts-station"], heading: "down", doors: "closed" });
    expect(hot(p)).toEqual([]);
    const car = p.model.section.hot.querySelector("[data-tip=cage]");
    const box = car.querySelector("rect");
    const rows = p.model.section.layout.rows;
    const y = (name) => rows.find((r) => r.name === name).y;
    expect(Number(box.getAttribute("y")) + 5).toBe((y("THE TOWN") + y("THE SMELTS")) / 2);
    expect(car.querySelectorAll("path")).toHaveLength(1); // the arrow
    expect(p.model.lights()).toMatch(/^level=none cage=91\/1/);
    expect(p.model.section.tips.get("cage")).toEqual({ title: "The Cage", body: "down, the Town → the Smelts" });
    cage(p, { at: "dolcoath.pithead", doors: "open" });
    expect(p.model.section.hot.querySelector("[data-tip=cage] path")).toBeNull(); // at a stop, no arrow
    expect(p.model.lights()).toMatch(/cage=0\/0/);
  });

  it("zooms and goes home, as the models do, but doesn't turn", () => {
    const { model } = place();
    const home = model.vb.slice();
    model.setView([0, 0, 50, 40]);
    expect(model.section.svg.getAttribute("viewBox")).toBe("0 0 50 40");
    const buttons = [...model.div.querySelectorAll("button")];
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    buttons.find((b) => b.textContent.includes("⌂")).click();
    expect(model.vb).toEqual(home);
    expect(() => model.setTurning(true)).not.toThrow();
  });
});

describe("the sky over the Pit", () => {
  it("shows in the Pit's three rooms open to the sky, framed on each, and the section anywhere else", () => {
    const p = place();
    expect(p.model.sky).toBeInstanceOf(SkyView);
    for (const room of ["field", "drops", "pithead"]) {
      at(p, room);
      expect(p.model.sky.div.style.display).toBe("");
      expect(p.model.section.div.style.display).toBe("none");
      expect(p.model.sky.frame).toBe(`dolcoath.${room}`);
    }
    at(p, "lamp-room");
    expect(p.model.sky.div.style.display).toBe("none");
    expect(p.model.section.div.style.display).toBe("");
    expect(p.model.sky.frame).toBe("dolcoath.pithead"); // indoors keeps the last
  });

  it("draws the Pit's rim, not Zennor's valley, with the headframe at the Pithead", () => {
    const p = place();
    at(p, "field");
    p.model.draw(Date.now());
    const land = p.model.sky.land;
    expect(land.children.length).toBeGreaterThan(0);
    // no ice cap along the horizon: that's Zennor's
    expect([...land.querySelectorAll("path")].some((e) => e.getAttribute("d") === "M-1500,52H1500")).toBe(false);
    const count = () => land.querySelectorAll("circle").length;
    const atField = count();
    at(p, "pithead");
    expect(count()).toBeGreaterThanOrEqual(atField); // the near headframe's sheave
  });

  it("gives its sky ids of its own, so Zennor's in the same page doesn't stand in for them", () => {
    const p = place();
    expect(p.model.sky.svg.querySelector("clipPath").id).toBe("sky-clip-dolcoath");
  });

  it("has no sky to keep up without charts", () => {
    const p = place();
    at(p, "field");
    expect(p.model.live).toBe(false);
  });
});

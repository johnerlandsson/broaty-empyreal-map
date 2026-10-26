// @vitest-environment happy-dom
// ModelView's cutaway modes: Orrin cut away at the Exchange (Deck 2), its Deck 3 above the cut;
// and its camera home per place, on T.I.S.S.

import { describe, expect, it } from "vitest";
import orrin from "../tests/fixtures/generated/orrin.js";
import { buildDecksModel, decksCut, decksKey, indexDecks } from "./lib/decks.js";
import { data } from "./data/places.js";
import { CAM, FRONT, camera } from "./lib/geometry.js";
import { indexStation, locate } from "./lib/locate.js";
import { awayLook } from "./lib/space.js";
import { tissRooms } from "./lib/look.js";
import { ModelView } from "./model-view.js";

const WHERE = { kind: "room", id: "orrin.market", level: 1 };

function build(view) {
  const index = indexDecks(orrin);
  const model = new ModelView(document.createElement("div"), index, {
    faces: buildDecksModel(index, orrin),
    keyOf: decksKey,
    hourOf: () => null,
    cutOf: (where) => decksCut(index, where),
    labels: false,
    view,
  });
  model.set(WHERE);
  return model;
}

const dashed = (m) => m.geo.querySelectorAll("path[stroke-dasharray]").length;
const ghosted = (m) => [...m.geo.querySelectorAll("path[fill-opacity]")];

describe("cutaway", () => {
  const hide = build({ cutaway: "hide-above" });
  const off = build({ cutaway: "off" });
  const ghost = build({ cutaway: "ghost-above" });

  it("hide-above is what it was without a view", () => {
    expect(hide.geo.innerHTML).toBe(build(undefined).geo.innerHTML);
    expect(dashed(hide)).toBe(1);
    expect(ghosted(hide)).toHaveLength(0);
  });

  it("off ignores the cut: no dashed outline, Deck 3 drawn solid", () => {
    expect(dashed(off)).toBe(0);
    expect(ghosted(off)).toHaveLength(0);
    expect(off.geo.children.length).toBeGreaterThan(hide.geo.children.length);
  });

  it("ghost-above draws Deck 3 at 15% fill, never lit", () => {
    const g = ghosted(ghost);
    expect(g.length).toBeGreaterThan(0);
    expect(g.every((p) => p.getAttribute("fill-opacity") === "0.15")).toBe(true);
    expect(dashed(ghost)).toBe(0);
    // every lit shape is on the cut deck or below
    const lit = ghost.shapes.children.length;
    expect(lit).toBe(hide.shapes.children.length);
    const top = build({ cutaway: "ghost-above" });
    top.set({ kind: "room", id: "orrin.berth", level: 2 }); // Deck 3: nothing above to ghost
    expect(ghosted(top)).toHaveLength(0);
  });
});

describe("camera", () => {
  const tiss = (camera) => {
    const index = indexStation(tissRooms(data.tiss));
    return new ModelView(document.createElement("div"), index, { view: camera ? { camera } : undefined });
  };
  const AT_3 = { kind: "room", id: "tiss.somewhere", level: 0, x: 6 }; // hour 3

  it("turns T.I.S.S.'s hour to the place's camera's front (Review Focus 5)", () => {
    const cam = { yaw: 40, pitch: 25, zoom: 1 };
    const front = camera(cam).front;
    expect(front).not.toBeCloseTo(FRONT, 3);
    const m = tiss(cam);
    expect(m.phi).toBeCloseTo(front, 9); // 12:00 faces this camera
    m.set(AT_3);
    const off = (((m.phi + 3 - front) % 12) + 12) % 12;
    expect(Math.min(off, 12 - off)).toBeCloseTo(0, 9);
    let target;
    m.animateTo = (t) => (target = t); // catch the turn's target rather than run it
    m.set({ kind: "room", id: "tiss.elsewhere", level: 0, x: 14 }); // hour 7
    expect(target).toBeDefined();
    const off7 = (((target + 7 - front) % 12) + 12) % 12;
    expect(Math.min(off7, 12 - off7)).toBeCloseTo(0, 9);
    m.setTurning(false);
    expect(m.phi).toBeCloseTo(front, 9);
  });

  it("zoom 2 can still zoom out past the whole model", () => {
    const m = tiss({ yaw: 40, pitch: 25, zoom: 2 });
    for (let i = 0; i < 10; i++) m.zoom(1.5);
    expect(m.vb[2]).toBeGreaterThanOrEqual(m.bounds[2]);
    expect(m.vb[2]).toBeCloseTo(m.bounds[2] * 1.2, 9);
  });

  it("zoom 0.5 takes its first zoom step from home without a snap", () => {
    const m = tiss({ yaw: 40, pitch: 25, zoom: 0.5 });
    const w = m.home[2];
    expect(w).toBeCloseTo(m.bounds[2] * 2, 9);
    m.zoom(1 / 1.5);
    expect(m.vb[2]).toBeCloseTo(w / 1.5, 9);
    m.setView(m.home.slice());
    m.zoom(1.5);
    expect(m.vb[2]).toBeCloseTo(w * 1.2, 9); // out to a bit past home, the farther of the two
  });

  it("no camera is the default camera at zoom 1", () => {
    const a = tiss();
    const b = tiss({ ...CAM, zoom: 1 });
    expect(b.bounds).toEqual(a.bounds);
    expect(b.vb).toEqual(a.vb);
    expect(b.phi).toBe(FRONT);
  });

  it("zoom 2 halves the home view box about the same centre", () => {
    const one = tiss({ yaw: 40, pitch: 25, zoom: 1 });
    const two = tiss({ yaw: 40, pitch: 25, zoom: 2 });
    const [x1, y1, w1, h1] = one.vb;
    const [x2, y2, w2, h2] = two.vb;
    expect(w2).toBeCloseTo(w1 / 2, 9);
    expect(h2).toBeCloseTo(h1 / 2, 9);
    expect(x2 + w2 / 2).toBeCloseTo(x1 + w1 / 2, 9);
    expect(y2 + h2 / 2).toBeCloseTo(y1 + h1 / 2, 9);
    // home (the zoom buttons' reset) and docking back (setAway 0) both come back to it
    two.setView([0, 0, 1, 1]);
    two.setAway(0.5);
    const { zoom } = awayLook(0.5);
    expect(two.vb[2]).toBeCloseTo(w2 * zoom, 9); // backed out from home, not from the whole model
    expect(two.vb[0] + two.vb[2] / 2).toBeCloseTo(x2 + w2 / 2, 9);
    two.setAway(0);
    expect(two.vb).toEqual([x2, y2, w2, h2]);
  });
});

describe("picking", () => {
  const make = (pick) => {
    const index = indexDecks(orrin);
    return new ModelView(document.createElement("div"), index, { faces: buildDecksModel(index, orrin), keyOf: decksKey, labels: false, pick });
  };
  const ID = "orrin.market";

  it("marks each keyed face with data-room only when asked", () => {
    expect(make(true).geo.querySelectorAll(`path[data-room="${ID}"]`).length).toBeGreaterThan(0);
    expect(make().geo.querySelector("[data-room]")).toBe(null);
  });

  it("calls onPick on a click on a face, not on a pan", () => {
    const m = make(true);
    const picked = [];
    m.onPick((id) => picked.push(id));
    const face = m.geo.querySelector(`path[data-room="${ID}"]`);
    const pointer = (type, x) => face.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: 50, button: 0, pointerId: 1 }));
    pointer("pointerdown", 50);
    pointer("pointerup", 53);
    expect(picked).toEqual([ID]);
    pointer("pointerdown", 50);
    pointer("pointermove", 70);
    pointer("pointermove", 51);
    pointer("pointerup", 51);
    expect(picked).toEqual([ID]);
  });
});

describe("picking on a wheel", () => {
  const index = indexStation(tissRooms(data.tiss));
  const m = new ModelView(document.createElement("div"), index, { pick: true });
  const picked = [];
  m.onPick((id) => picked.push(id));
  const click = (face) => {
    picked.length = 0;
    face.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 5, clientY: 5, button: 0, pointerId: 1 }));
    face.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: 5, clientY: 5, button: 0, pointerId: 1 }));
    return picked[0];
  };
  const faces = [...m.geo.querySelectorAll("path[data-room]")];

  it("marks faces with room ids only, never face keys", () => {
    expect(faces.length).toBeGreaterThan(0);
    for (const f of faces) expect(index.byId.has(f.getAttribute("data-room"))).toBe(true);
  });

  it("gives a ring face's room, which locate resolves", () => {
    const ring = faces.find((f) => index.byId.get(f.getAttribute("data-room")).z < 3 && !f.getAttribute("data-room").includes("ladderway"));
    const id = click(ring);
    expect(id).toMatch(/^tiss\./);
    expect(locate(index, { roomId: id }, null).kind).toBe("room");
  });

  it("gives a spoke face its ladderway", () => {
    const spoke = m.faces.find((f) => f.key?.startsWith("spoke:") && m.roomOf.has(f.key));
    const id = m.roomOf.get(spoke.key);
    expect(id).toMatch(/ladderway/);
    const face = faces.find((f) => f.getAttribute("data-room") === id);
    expect(click(face)).toBe(id);
  });
});

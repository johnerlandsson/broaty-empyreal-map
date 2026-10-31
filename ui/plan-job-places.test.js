// @vitest-environment happy-dom
// Odd jobs on the plans (reference/job-places-options.png, option A): the jobs window (flag `jobs`)
// and each drop point (`drop`) have a mark in the bin's family, and a drop point a row on hover. On
// a ring they're in the room's far corner, antispinward; the bin has the spinward one.

import { afterEach, describe, expect, it, vi } from "vitest";
import freighter from "./data/plans/freighter.js";
import places, { data } from "./data/places.js";
import tiss from "./data/tiss.js";
import zennor from "./data/zennor.js";
import orrin from "../tests/fixtures/generated/orrin.js";
import { textWidth } from "./lib/decks.js";
import { buildPlace, buildShip } from "./place-views.js";

const div = () => document.createElement("div");
const at = (mark) => mark.getAttribute("transform").match(/translate\((\S+) (\S+)\)/).slice(1).map(Number);
const marks = (g, kind) => [...g.querySelectorAll(kind ? `[data-job="${kind}"]` : "[data-job]")];
const lapOf = (m) => m.closest("g[transform]")?.getAttribute("transform") === "translate(0 0)";
const lap = (g, kind) => marks(g, kind).filter(lapOf);
const allMarks = (place) => place.deck.plans.flatMap((p) => marks(p.g));

// a place with `extra` merged into the rooms it names
const withRooms = (place, extra) => ({ ...place, rooms: place.rooms.map((r) => (extra[r.id] ? { ...r, ...extra[r.id], flags: [...(r.flags ?? []), ...(extra[r.id].flags ?? [])] } : r)) });
const BOTH = { flags: ["jobs", "bin"], drop: { name: "intake" } };

// the mark's half width and height, with a little room round it
const [HW, HH] = [6, 5];
const clearOf = ([x, y], r) => x + HW <= r.x0 || x - HW >= r.x1 || y + HH <= r.y0 || y - HH >= r.y1;
function textBoxes(g) {
  return [...g.querySelectorAll("text")].filter((t) => t.textContent && t.getAttribute("display") !== "none").map((t) => {
    const [x, y, size] = ["x", "y", "font-size"].map((a) => +t.getAttribute(a));
    const w = textWidth(t.textContent, size);
    const anchor = t.getAttribute("text-anchor");
    const x0 = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
    return { text: t.textContent, x0, x1: x0 + w, y0: y - size * 0.6, y1: y + size * 0.6 };
  });
}

describe("jobs and drop points on T.I.S.S.'s rings", () => {
  const place = buildPlace(tiss, "wheel", div(), div());
  const [rim, mid, inner, docks] = place.deck.plans;
  const box = (plan, id) => plan.layout.rooms.find((b) => b.room.id === id);
  const markIn = (plan, id) => lap(plan.g).map(at).find(([x, y]) => Math.abs(x - box(plan, id).cx) < box(plan, id).w / 2 && Math.abs(y - box(plan, id).cy) < box(plan, id).h / 2);

  it("marks the Services Counter as the jobs window and the four drop points, once a lap", () => {
    expect(lap(mid.g, "jobs")).toHaveLength(1);
    expect(marks(mid.g, "jobs")).toHaveLength(3);
    expect(lap(rim.g, "drop")).toHaveLength(3);
    expect(lap(inner.g, "drop")).toHaveLength(1);
    expect(lap(rim.g, "jobs")).toHaveLength(0);
    expect(marks(mid.g, "drop")).toHaveLength(0);
    expect(marks(inner.g, "jobs")).toHaveLength(0);
    expect(marks(docks.g)).toHaveLength(0);
  });

  it("puts each in its room's far corner, antispinward, fore or aft", () => {
    const corner = (plan, id, sg) => {
      const b = box(plan, id);
      return [b.cx - b.w / 2 + 11, b.cy + (sg * b.h) / 2 - sg * 7.5];
    };
    expect(markIn(mid, "tiss.services")).toEqual(corner(mid, "tiss.services", 1));
    expect(markIn(rim, "tiss.kitchen")).toEqual(corner(rim, "tiss.kitchen", 1));
    expect(markIn(rim, "tiss.growbays")).toEqual(corner(rim, "tiss.growbays", -1));
    expect(markIn(rim, "tiss.clinic")).toEqual(corner(rim, "tiss.clinic", -1));
    expect(markIn(inner, "tiss.scrapyard")).toEqual(corner(inner, "tiss.scrapyard", -1));
  });

  it("keeps clear of every name on the plan", () => {
    for (const plan of [rim, mid, inner]) {
      const names = textBoxes(plan.g);
      for (const m of lap(plan.g)) for (const r of names) expect(clearOf(at(m), r), r.text).toBe(true);
    }
  });

  it("draws nothing that isn't a window or a tray: no fittings, no faults", () => {
    expect(tiss.rooms.filter((r) => r.flags?.includes("jobs")).map((r) => r.id)).toEqual(["tiss.services"]);
    expect(tiss.rooms.filter((r) => r.drop).map((r) => [r.id, r.drop])).toEqual([
      ["tiss.scrapyard", { name: "metal bin" }],
      ["tiss.kitchen", { name: "intake" }],
      ["tiss.growbays", { name: "supply hatch" }],
      ["tiss.clinic", { name: "stores" }],
    ]);
    for (const r of tiss.rooms) expect(r).not.toHaveProperty("fittings");
  });
});

describe("hovering a drop point", () => {
  afterEach(() => {
    delete window.panel;
  });

  function rowsOf(id, plan) {
    const show = vi.fn();
    window.panel = { tooltip: { show } };
    const node = plan.g.querySelector(`[data-room="${id}"]`);
    node.dispatchEvent(new Event("mouseenter"));
    return show.mock.calls[0][1].rows;
  }
  const ring = (d, level) => buildPlace(d, "wheel", div(), div(), { pick: true }).deck.plans[level];

  it("names the drop point, on each of the four", () => {
    expect(rowsOf("tiss.kitchen", ring(tiss, 0))).toEqual([{ label: "Drop point", value: "intake" }]);
    expect(rowsOf("tiss.growbays", ring(tiss, 0))).toEqual([{ label: "Drop point", value: "supply hatch" }]);
    expect(rowsOf("tiss.clinic", ring(tiss, 0))).toEqual([{ label: "Drop point", value: "stores" }]);
    expect(rowsOf("tiss.scrapyard", ring(tiss, 2))).toEqual([{ label: "Drop point", value: "metal bin" }]);
  });

  it("adds no row anywhere else, the jobs window included", () => {
    expect(rowsOf("tiss.services", ring(tiss, 1))).toEqual([]);
    expect(rowsOf("tiss.market", ring(tiss, 0))).toEqual([]);
  });
});

describe("where the game has none", () => {
  it("marks no other place's plan", () => {
    for (const p of places.filter((q) => q.id !== "tiss" && data[q.id])) {
      expect(allMarks(buildPlace(data[p.id], p.builder, div(), div())), p.id).toHaveLength(0);
    }
  });

  it("marks no ship", () => {
    expect(marks(buildShip(freighter, div(), div(), { name: "Mule" }).deck.plans[0].g)).toHaveLength(0);
  });
});

describe("in other areas later", () => {
  const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  it("keeps a room's window, drop and bin apart on a ring", () => {
    const plan = buildPlace(withRooms(tiss, { "tiss.market": BOTH }), "wheel", div(), div()).deck.plans[0];
    const b = plan.layout.rooms.find((r) => r.room.id === "tiss.market");
    const inRoom = ([x, y]) => Math.abs(x - b.cx) < b.w / 2 && Math.abs(y - b.cy) < b.h / 2;
    const [job, drop] = [lap(plan.g, "jobs"), lap(plan.g, "drop")].map((ms) => ms.map(at).find(inRoom));
    const bin = [...plan.g.querySelectorAll("[data-bin]")].filter(lapOf).map(at).find(inRoom);
    expect(near(job, drop)).toBeGreaterThanOrEqual(13);
    expect(near(drop, bin)).toBeGreaterThanOrEqual(13);
    for (const r of textBoxes(plan.g)) for (const m of [job, drop]) expect(clearOf(m, r), r.text).toBe(true);
  });

  it("marks a corridor stop and a ladderway on the corridor, clear of its lift, hatch, bin and hours", () => {
    const stops = { "tiss.concourse": { flags: ["jobs"] }, "tiss.ladderway-12-rim": { drop: { name: "chute" } } };
    const plan = buildPlace(withRooms(tiss, stops), "wheel", div(), div()).deck.plans[0];
    const onIt = lap(plan.g).map(at).filter(([, y]) => y === 0).map(([x]) => x);
    const cx = plan.layout.stops.find((s) => s.hour === 0).cx;
    expect(onIt).toEqual([cx + 62, cx + 78]);
    // the widened hatch ends at 51, the next stop's hour starts at 150 - 44 - its half width
    expect(cx + 62 - HW).toBeGreaterThan(cx + 51);
    expect(cx + 78 + HW).toBeLessThan(cx + 150 - 44 - 13);
  });

  it("marks the Docks plan's rooms, spine and hub", () => {
    const found = tiss.rooms.filter((r) => r.at?.z === 3).map((r) => r.id);
    const picked = Object.fromEntries(found.map((id) => [id, { drop: { name: "x" } }]));
    const plan = buildPlace(withRooms(tiss, picked), "wheel", div(), div()).deck.plans[3];
    expect(marks(plan.g, "drop")).toHaveLength(found.length);
    for (const r of textBoxes(plan.g).filter((t) => !t.text.startsWith("Spine"))) for (const m of marks(plan.g)) expect(clearOf(at(m), r), r.text).toBe(true);
  });

  it("on a decks station keeps clear of a bin, a hatch, its name and the room's edge", () => {
    const rooms = { "orrin.market": BOTH, "orrin.concourse": BOTH };
    const place = buildPlace(withRooms(orrin, rooms), "decks", div(), div());
    expect(allMarks(place)).toHaveLength(4);
    for (const p of place.deck.plans) {
      for (const id of Object.keys(rooms)) {
        const c = p.layout.cells.find((cell) => cell.room.id === id);
        if (!c) continue;
        const inRoom = marks(p.g).map(at).filter(([x, y]) => Math.abs(x - c.cx) <= c.w / 2 && Math.abs(y - c.cy) <= c.h / 2);
        expect(inRoom, id).toHaveLength(2);
        for (const m of inRoom) {
          for (const r of textBoxes(p.g)) expect(clearOf(m, r), `${id} on ${r.text}`).toBe(true);
          for (const h of p.layout.hatches) expect(near(m, [h.cx, h.cy]), id).toBeGreaterThan(9 + HW);
          for (const b of [...p.g.querySelectorAll("[data-bin]")].map(at)) expect(near(m, b), id).toBeGreaterThanOrEqual(13);
          expect(Math.abs(m[0] - c.cx) + HW, id).toBeLessThanOrEqual(c.w / 2);
          expect(Math.abs(m[1] - c.cy) + HW, id).toBeLessThanOrEqual(c.h / 2);
        }
      }
    }
  });

  it("on a ship's plan goes round her props", () => {
    const rooms = Object.fromEntries(freighter.rooms.map((r) => [r.id, BOTH]));
    const plan = buildShip(withRooms(freighter, rooms), div(), div(), { name: "Mule" }).deck.plans[0];
    const props = [...plan.g.querySelectorAll("[data-fixture] rect")].map((r) => {
      const [x, y, w, h] = ["x", "y", "width", "height"].map((a) => +r.getAttribute(a));
      return { x0: x, x1: x + w, y0: y, y1: y + h };
    });
    expect(props.length).toBeGreaterThan(0);
    expect(marks(plan.g).length).toBeGreaterThan(0);
    const small = props.filter((p) => p.x1 - p.x0 < 60); // the rails' box runs the hold's length
    for (const m of marks(plan.g).map(at)) for (const p of small) expect(clearOf(m, p), `${m} on ${JSON.stringify(p)}`).toBe(true);
  });

  it("on a town's plan runs west from the bin, and clear of the names", () => {
    const rooms = { "zennor.covered-market": { flags: ["jobs"], drop: { name: "x" } } };
    const plan = buildPlace(withRooms(zennor, rooms), "town", div(), div()).deck.plans[0];
    const b = plan.layout.boxes.find((r) => r.room.id === "zennor.covered-market");
    const y = b.cy + b.h / 2 - 11;
    expect(marks(plan.g).map(at)).toEqual([[b.cx + b.w / 2 - 27, y], [b.cx + b.w / 2 - 43, y]]);
    for (const r of textBoxes(plan.g)) for (const m of marks(plan.g)) expect(clearOf(at(m), r), r.text).toBe(true);
  });

  it("on a drum's plan marks a box's north-west corner and the axis room", () => {
    const rooms = Object.fromEntries(data.wenna.rooms.map((r) => [r.id, { drop: { name: "x" } }]));
    const plan = buildPlace(withRooms(data.wenna, rooms), "drum", div(), div()).deck.plans[0];
    const { boxes } = plan.layout;
    expect(marks(plan.g)).toHaveLength(boxes.length + 1);
    for (const b of boxes) expect(marks(plan.g).map(at)).toContainEqual([b.cx - b.w / 2 + 11, b.cy - b.h / 2 + 11]);
    for (const r of textBoxes(plan.g)) for (const m of marks(plan.g)) expect(clearOf(at(m), r), r.text).toBe(true);
  });
});

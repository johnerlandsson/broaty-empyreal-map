import { describe, expect, it } from "vitest";
import { Belt, Starfield, Town, approach, awayAt, awayLook, clouds, heading, litFor, moveCard, rockFaces, makeRock, targets, work, workLines } from "./space.js";
import { rng } from "./svg.js";

describe("targets", () => {
  it("station hides space", () => {
    expect(targets("station").space).toBe(0);
  });

  it("parked shows still stars, no rocks", () => {
    const t = targets("parked");
    expect(t).toMatchObject({ space: 1, belt: 0 });
    expect(t.speed).toBeLessThan(0.05);
  });

  it("travelling streams at full speed", () => {
    expect(targets("travelling")).toMatchObject({ space: 1, belt: 0, speed: 1 });
  });

  it("belt shows rocks and stops the stars", () => {
    expect(targets("belt")).toMatchObject({ space: 1, belt: 1, speed: 0 });
  });

  it("port shows the ground under still stars, no rocks", () => {
    const t = targets("port");
    expect(t).toMatchObject({ space: 1, belt: 0, ground: 1 });
    expect(t.speed).toBeLessThan(0.05);
  });

  it("only port shows the ground", () => {
    for (const s of ["station", "parked", "travelling", "belt", "orbit"]) expect(targets(s).ground).toBe(0);
  });

  it("orbit shows the planet's face under still stars, no town, no rocks", () => {
    const t = targets("orbit");
    expect(t).toMatchObject({ space: 1, belt: 0, ground: 0, orbit: 1 });
    expect(t.speed).toBeLessThan(0.05);
    for (const s of ["station", "parked", "travelling", "belt", "port"]) expect(targets(s).orbit).toBe(0);
  });

  it("an unknown scene is the station", () => {
    expect(targets("nonsense")).toEqual(targets("station"));
  });
});

describe("litFor", () => {
  it("is day, night, or a dusk between when her side isn't known", () => {
    expect(litFor(true)).toBe(1);
    expect(litFor(false)).toBe(0);
    expect(litFor(null)).toBe(0.5);
  });
});

describe("clouds", () => {
  it("are bands along the curve, faint, seeded", () => {
    const c = clouds(22, rng(11));
    expect(c).toHaveLength(22);
    for (const b of c) {
      expect(b.d).toBeGreaterThanOrEqual(0);
      expect(b.d).toBeLessThan(1);
      expect(Math.abs(b.a)).toBeLessThanOrEqual(0.65);
      expect(b.len).toBeGreaterThan(0);
      expect(b.alpha).toBeLessThan(0.12);
    }
    expect(clouds(22, rng(11))).toEqual(c);
  });
});

describe("approach", () => {
  it("moves part way toward the target", () => {
    const v = approach(0, 1, 0.1, 2);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(1);
  });

  it("snaps when close", () => {
    expect(approach(0.9995, 1, 0.016, 2)).toBe(1);
  });

  it("never moves away on a negative step (a frame stamped before the loop started)", () => {
    expect(approach(0, 1, -0.01, 2)).toBe(0);
  });

  it("never overshoots on a long frame", () => {
    expect(approach(0, 1, 10, 2)).toBe(1);
  });
});

describe("Starfield", () => {
  it("holds still at speed 0", () => {
    const f = new Starfield(50, rng(1));
    const before = structuredClone(f.stars);
    f.step(0.5, 0);
    expect(f.stars).toEqual(before);
  });

  it("brings stars nearer while moving", () => {
    const f = new Starfield(50, rng(1));
    const z0 = f.stars.map((s) => s.z);
    f.step(0.01, 1);
    f.stars.forEach((s, i) => expect(s.z).toBeLessThan(z0[i]));
  });

  it("recycles stars that pass the camera to the far plane", () => {
    const f = new Starfield(50, rng(1));
    for (let i = 0; i < 200; i++) f.step(0.05, 1);
    for (const s of f.stars) {
      expect(s.z).toBeGreaterThan(0);
      expect(s.z).toBeLessThanOrEqual(1);
    }
  });

  it("draws longer streaks at speed", () => {
    const len = (speed) => {
      const f = new Starfield(50, rng(1));
      f.step(0.016, speed);
      return f.segments(360, 220).reduce((a, [x0, y0, x1, y1]) => a + Math.hypot(x1 - x0, y1 - y0), 0);
    };
    expect(len(1)).toBeGreaterThan(len(0.01) * 10);
  });
});

describe("rocks", () => {
  it("shows only front faces, far to near, in the three tones", () => {
    const faces = rockFaces(makeRock(rng(3)), 0.7, 1.9);
    expect(faces.length).toBeGreaterThan(0);
    expect(faces.length).toBeLessThan(20);
    for (let i = 1; i < faces.length; i++) expect(faces[i].z).toBeGreaterThanOrEqual(faces[i - 1].z);
    for (const f of faces) {
      expect(f.pts).toHaveLength(3);
      expect([0, 1, 2]).toContain(f.tone);
    }
  });

  it("drift right to left and come back on the right", () => {
    const b = new Belt(12, rng(5));
    const w = 360;
    const h = 220;
    b.step(0, w, h);
    const x0 = b.rocks.map((r) => r.x);
    b.step(0.1, w, h);
    b.rocks.forEach((r, i) => expect(r.x).toBeLessThan(x0[i]));
    for (let i = 0; i < 2000; i++) b.step(0.1, w, h);
    for (const r of b.rocks) expect(r.x).toBeGreaterThan(-r.size * 2 - 1);
  });

  it("are listed far to near", () => {
    const b = new Belt(12, rng(5));
    b.step(0.1, 360, 220);
    for (let i = 1; i < b.rocks.length; i++) expect(b.rocks[i].d).toBeGreaterThanOrEqual(b.rocks[i - 1].d);
  });
});

describe("Belt moving", () => {
  const w = 360;
  const h = 220;
  const run = (b, dir, secs) => {
    for (let i = 0; i < secs * 10; i++) b.step(0.1, w, h, dir);
  };

  it("eases into a drift opposite her heading, near rocks faster", () => {
    const b = new Belt(12, rng(5));
    b.step(0, w, h);
    run(b, [0, -1], 3); // straight out: up the view
    const before = new Map(b.rocks.map((r) => [r.id, r]));
    b.step(0.1, w, h, [0, -1]);
    const moved = b.rocks.filter((r) => before.has(r.id));
    for (const r of moved) {
      const was = before.get(r.id);
      expect(r.y).toBeGreaterThan(was.y);
      expect(Math.abs(r.x - was.x)).toBeLessThan(0.05); // the idle drift all but gone
    }
    const near = moved.reduce((a, c) => (c.d > a.d ? c : a));
    const far = moved.reduce((a, c) => (c.d < a.d ? c : a));
    expect(near.y - before.get(near.id).y).toBeGreaterThan(far.y - before.get(far.id).y);
  });

  it("starts from the idle drift, not at full speed", () => {
    const b = new Belt(12, rng(5));
    b.step(0, w, h);
    const y0 = new Map(b.rocks.map((r) => [r.id, r.y]));
    b.step(0.05, w, h, [0, -1]);
    for (const r of b.rocks) if (y0.has(r.id)) expect(r.y - y0.get(r.id)).toBeLessThan(2);
  });

  it("keeps the view full, coming in from the edge she heads for", () => {
    for (const dir of [[0, -1], [0, 1], [1, 0], [-0.6, 0.8]]) {
      const b = new Belt(12, rng(7));
      b.step(0, w, h);
      run(b, dir, 60);
      expect(b.rocks).toHaveLength(12);
      const inside = b.rocks.filter((r) => r.x > 0 && r.x < w && r.y > 0 && r.y < h);
      expect(inside.length).toBeGreaterThan(4);
    }
  });

  it("settles back into the idle drift when she stops", () => {
    const b = new Belt(12, rng(5));
    b.step(0, w, h);
    run(b, [0, -1], 3);
    run(b, null, 5);
    const before = new Map(b.rocks.map((r) => [r.id, r]));
    b.step(0.1, w, h, null);
    for (const r of b.rocks) {
      const was = before.get(r.id);
      if (!was) continue;
      expect(r.x).toBeLessThan(was.x);
      expect(Math.abs(r.y - was.y)).toBeLessThan(0.01);
    }
  });
});

describe("Belt hold", () => {
  const w = 360;
  const h = 220;
  const belt = () => {
    const b = new Belt(14, rng(5));
    b.step(0.1, w, h);
    return b;
  };

  it("holds nothing until asked", () => {
    const b = belt();
    expect(b.hold(false, w, h)).toBe(null);
  });

  it("holds a near rock in the middle, and keeps the same one", () => {
    const b = belt();
    const k = b.hold(true, w, h);
    expect(k.d).toBeGreaterThan(0.55);
    expect(k.x).toBeGreaterThan(w * 0.15);
    expect(k.x).toBeLessThan(w * 0.85);
    b.step(0.5, w, h);
    expect(b.hold(true, w, h).id).toBe(k.id);
  });

  it("the held rock stays put but tumbles; the others drift on", () => {
    const b = belt();
    const k = b.hold(true, w, h);
    const other = b.rocks.find((r) => r.id !== k.id);
    for (let i = 0; i < 100; i++) b.step(0.1, w, h);
    const held = b.rocks.find((r) => r.id === k.id);
    expect(held.x).toBe(k.x);
    expect(held.a).not.toBe(k.a);
    expect(b.rocks.find((r) => r.id === other.id)?.x ?? -Infinity).not.toBe(other.x);
  });

  it("lets go when the work ends, and the rock drifts again", () => {
    const b = belt();
    const k = b.hold(true, w, h);
    expect(b.hold(false, w, h)).toBe(null);
    b.step(0.5, w, h);
    expect(b.rocks.find((r) => r.id === k.id).x).toBeLessThan(k.x);
  });

  it("holds nothing before the rocks are scattered", () => {
    expect(new Belt(14, rng(5)).hold(true, w, h)).toBe(null);
  });

  it("of the near ones, holds the one nearest the middle of the view", () => {
    const b = belt();
    b.rocks = b.rocks.map((r, i) => ({ ...r, d: 0.8, x: w / 2, y: i * 15 }));
    expect(b.hold(true, w, h).y).toBe(105);
  });

  it("holds the rock nearest the middle when none is near and central", () => {
    const b = belt();
    b.rocks = b.rocks.map((r, i) => ({ ...r, d: 0.3, x: i * 2, y: h / 2 }));
    expect(b.hold(true, w, h).x).toBe(26);
  });
});

describe("work", () => {
  it("is nothing with no message or nothing under way", () => {
    const idle = { sweep: null, assay: null, cut: false, moving: null };
    expect(work(null, 0)).toEqual(idle);
    expect(work({}, 0)).toEqual(idle);
    expect(work("x", 0)).toEqual(idle);
  });

  it("a scan fills from when it began to its end, with the seconds left", () => {
    const m = { sensors: { busy: "scan", since: 100, ends: 110 } };
    expect(work(m, 100).sweep).toEqual({ p: 0, left: 10 });
    expect(work(m, 104.2).sweep).toEqual({ p: expect.closeTo(0.42), left: 6 });
    expect(work(m, 110).sweep).toEqual({ p: 1, left: 0 });
    expect(work(m, 113).sweep).toEqual({ p: 1, left: 0 }); // still busy till the game says otherwise
    expect(work(m, 90).sweep).toEqual({ p: 0, left: 10 }); // a clock behind the stamp
  });

  it("an assay likewise, and only one of them at a time", () => {
    const w = work({ sensors: { busy: "assay", since: 0, ends: 20 } }, 5);
    expect(w.assay).toEqual({ p: 0.25, left: 15 });
    expect(w.sweep).toBe(null);
  });

  it("an end at its start is done", () => {
    expect(work({ sensors: { busy: "scan", since: 5, ends: 5 } }, 5).sweep).toEqual({ p: 1, left: 0 });
  });

  it("with no end it sweeps round at its par, with no seconds", () => {
    const m = { sensors: { busy: "scan", since: 0 } };
    expect(work(m, 2.5).sweep).toEqual({ p: 0.25, left: null });
    expect(work(m, 12.5).sweep).toEqual({ p: 0.25, left: null });
    expect(work({ sensors: { busy: "assay", since: 0 } }, 5).assay).toEqual({ p: 0.25, left: null });
  });

  it("mining is the laser cutting", () => {
    expect(work({ laser: { busy: "mine", since: 0 } }, 9).cut).toBe(true);
    expect(work({ laser: { busy: "repair", since: 0, ends: 9 } }, 1).cut).toBe(false);
  });

  it("any other verb on the sensors shows nothing", () => {
    expect(work({ sensors: { busy: "repair", since: 0, ends: 30 } }, 1)).toEqual({ sweep: null, assay: null, cut: false, moving: null });
  });
});

describe("work: moving in the belt", () => {
  it("the thrusters under way are her moving, the way she goes as the place says", () => {
    expect(work({ nav: { busy: "rcs", since: 0, ends: 20 }, belt: { moved: 3, way: 0 } }, 4).moving).toEqual({ way: 0, closing: false });
    expect(work({ nav: { busy: "rcs", since: 0, ends: 20 }, belt: {} }, 0.5).moving).toEqual({ way: null, closing: false }); // not moved yet
  });

  it("a halted move stops her at once, however lately the place changed", () => {
    expect(work({ belt: { moved: 10, way: 0 } }, 10.5).moving).toBe(null);
  });

  it("mining, the place changing since it began is closing on the rock: no beam", () => {
    const m = { laser: { busy: "mine", since: 100 }, belt: { moved: 104, way: 90, target: "rock-12" } };
    expect(work(m, 105)).toEqual({ sweep: null, assay: null, cut: false, moving: { way: 90, closing: true } });
  });

  it("beside it, the place still, the beam cuts", () => {
    const m = { laser: { busy: "mine", since: 100 }, belt: { moved: 104, way: 90 } };
    expect(work(m, 106.4).cut).toBe(false);
    expect(work(m, 106.6)).toEqual({ sweep: null, assay: null, cut: true, moving: null });
  });

  it("a cut just begun holds the beam a beat, in case she's to close on it first", () => {
    const m = { laser: { busy: "mine", since: 100 }, belt: { moved: 50, way: 0 } };
    expect(work(m, 101)).toEqual({ sweep: null, assay: null, cut: false, moving: null });
    expect(work(m, 102.6).cut).toBe(true);
  });

  it("mine stopping an rcs closes on from where she'd got to", () => {
    const m = { laser: { busy: "mine", since: 102 }, belt: { moved: 103, way: 90 } };
    expect(work(m, 103.5).moving).toEqual({ way: 90, closing: true });
  });

  it("a move just before the cut began isn't closing", () => {
    const m = { laser: { busy: "mine", since: 102 }, belt: { moved: 101, way: 0 } };
    expect(work(m, 102.5).moving).toBe(null);
  });
});

describe("heading", () => {
  it("is up for straight out from the core, down for in, sideways round it", () => {
    const close = (v, x, y) => {
      expect(v[0]).toBeCloseTo(x);
      expect(v[1]).toBeCloseTo(y);
    };
    close(heading(0), 0, -1);
    close(heading(180), 0, 1);
    close(heading(90), 1, 0);
    close(heading(-90), -1, 0);
  });
});

describe("moveCard", () => {
  const S = 1000;
  it("the thrusters, which way, the seconds left and the bar", () => {
    const m = { nav: { busy: "rcs", since: 100, ends: 120 }, belt: { moved: 105, way: 4 } };
    expect(moveCard(m, 105 * S)).toEqual({ label: "thrusters, out from the core", detail: "", seconds: 15, fraction: 0.75, ms: 15000, recheck: null });
    expect(moveCard({ ...m, belt: { moved: 105, way: -170 } }, 105 * S).label).toBe("thrusters, in toward the core");
    expect(moveCard({ ...m, belt: { moved: 105, way: 100 } }, 105 * S).label).toBe("thrusters, on a new heading");
    expect(moveCard({ ...m, belt: {} }, 100 * S).label).toBe("thrusters");
  });

  it("closing on a rock names it, with no seconds: the game gives none", () => {
    const m = { laser: { busy: "mine", since: 100 }, belt: { moved: 104, way: 90, target: "rock-12" } };
    expect(moveCard(m, 104.5 * S)).toEqual({ label: "closing on rock-12", detail: "", seconds: null, fraction: null, ms: null, recheck: 2000 });
    expect(moveCard({ ...m, belt: { moved: 104, way: 90 } }, 104.5 * S).label).toBe("closing on the rock");
  });

  it("is nothing while she's still", () => {
    expect(moveCard({}, 0)).toBe(null);
    expect(moveCard(null, 0)).toBe(null);
    expect(moveCard({ laser: { busy: "mine", since: 0 }, belt: { moved: 1, way: 0 } }, 9 * S)).toBe(null);
  });
});

describe("workLines", () => {
  it("says what's under way and the seconds left, the laser first", () => {
    expect(workLines({ sweep: { p: 0.4, left: 6 }, assay: null, cut: true })).toEqual(["cutting", "sweeping · 6 s"]);
    expect(workLines({ sweep: null, assay: { p: 0.6, left: 8 }, cut: false })).toEqual(["assaying · 8 s"]);
  });

  it("drops the seconds when there are none left or none known", () => {
    expect(workLines({ sweep: { p: 1, left: 0 }, assay: null, cut: false })).toEqual(["sweeping"]);
    expect(workLines({ sweep: null, assay: { p: 0.2, left: null }, cut: false })).toEqual(["assaying"]);
  });

  it("is empty when idle", () => {
    expect(workLines({ sweep: null, assay: null, cut: false })).toEqual([]);
  });
});

describe("Town", () => {
  const town = new Town(rng(5));
  const off = ([x, y]) => Math.abs(x) > town.field.w / 2 || Math.abs(y) > town.field.h / 2;

  it("keeps roofs and lamps off the landing field", () => {
    expect(town.roofs.length).toBeGreaterThan(10);
    expect(town.lamps.length).toBeGreaterThan(10);
    for (const r of town.roofs) expect(off([r.x, r.y]) || off([r.x + r.w, r.y + r.h])).toBe(true);
    for (const l of town.lamps) expect(off([l.x, l.y])).toBe(true);
  });

  it("puts a beacon at each corner of the field", () => {
    const { w, h } = town.field;
    expect(town.beacons.map((b) => [Math.abs(b.x), Math.abs(b.y)])).toEqual(Array(4).fill([w / 2, h / 2]));
  });

  it("is the same town from the same seed", () => {
    expect(new Town(rng(5))).toEqual(town);
  });
});

describe("awayAt", () => {
  const undock = { verb: "undock", start: 1000, end: 11000 };
  const dock = { verb: "dock", start: 1000, end: 21000 };

  it("undocking, the station falls away from as docked to backed out", () => {
    expect(awayAt(undock, 1000)).toBe(0);
    expect(awayAt(undock, 6000)).toBeCloseTo(0.5);
    expect(awayAt(undock, 11000)).toBe(1);
  });

  it("docking, it draws near from backed out to as docked", () => {
    expect(awayAt(dock, 1000)).toBe(1);
    expect(awayAt(dock, 11000)).toBeCloseTo(0.5);
    expect(awayAt(dock, 21000)).toBe(0);
  });

  it("moves steadily: never back, eased at the ends", () => {
    let prev = -1;
    for (let t = 1000; t <= 11000; t += 250) {
      const a = awayAt(undock, t);
      expect(a).toBeGreaterThanOrEqual(prev);
      prev = a;
    }
    expect(awayAt(undock, 1500)).toBeLessThan(0.05);
  });

  it("holds at its ends before and after the run", () => {
    expect(awayAt(undock, 0)).toBe(0);
    expect(awayAt(dock, 60000)).toBe(0);
  });

  it("a run with no length is over", () => {
    expect(awayAt({ verb: "dock", start: 5, end: 5 }, 0)).toBe(0);
  });

  it("anything else is null", () => {
    expect(awayAt(null, 0)).toBeNull();
    expect(awayAt({ verb: "travel", start: 0, end: 10 }, 5)).toBeNull();
  });
});

describe("awayLook", () => {
  it("as docked: the model as it is, no starfield over it", () => {
    expect(awayLook(0)).toEqual({ zoom: 1, model: 1, stars: 0 });
  });

  it("backed out: a twelfth of its size, gone into the starfield", () => {
    expect(awayLook(1)).toEqual({ zoom: 12, model: 0, stars: 1 });
  });

  it("fades only at the far end", () => {
    expect(awayLook(0.8).model).toBe(1);
    expect(awayLook(0.9).model).toBeCloseTo(0.5);
  });

  it("clamps out-of-range distances", () => {
    expect(awayLook(-1)).toEqual(awayLook(0));
    expect(awayLook(2)).toEqual(awayLook(1));
  });
});

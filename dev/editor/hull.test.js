import { describe, expect, it } from "vitest";
import generated from "../../tests/fixtures/generated/orrin.js";
import { indexDecks } from "../../ui/lib/decks.js";
import { boundsOf } from "../../ui/lib/footprint.js";
import { hullFromRooms } from "./hull.js";

const index = indexDecks(generated);

/** Twice the signed area: positive for counter-clockwise. */
const area2 = (points) => points.reduce((sum, [x, y], i) => {
  const [u, v] = points[(i + 1) % points.length];
  return sum + x * v - u * y;
}, 0);

/** Whether a point is strictly inside a polygon (an odd number of crossings to its right). */
function inside(points, [px, py]) {
  let odd = false;
  points.forEach(([x, y], i) => {
    const [u, v] = points[(i + 1) % points.length];
    if ((y > py) !== (v > py) && px < x + ((py - y) / (v - y)) * (u - x)) odd = !odd;
  });
  return odd;
}

/** Whether every turn of a path is a corner: no two edges in a row on one line. */
const cornersOnly = (points) => points.every((p, i) => {
  const a = points[(i + points.length - 1) % points.length];
  const b = points[(i + 1) % points.length];
  return Math.abs((p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0])) > 1e-9;
});

const roomsOn = (deck) => [...index.byId.values()].filter((r) => r.cell.z === deck && !r.blister);

describe("hullFromRooms", () => {
  it("traces Orrin's deck 3 as a cross 0.12 outside its cells, counter-clockwise", () => {
    const path = hullFromRooms(index, 3);
    expect(path).toHaveLength(12);
    expect(area2(path)).toBeGreaterThan(0);
    expect(cornersOnly(path)).toBe(true);
    expect(path.every((p) => p.length === 2)).toBe(true);
    const { x0, x1, y0, y1 } = boundsOf(path);
    expect([x0, x1, y0, y1]).toEqual([-1.62, 1.62, 0.38, 3.62]);
    for (const room of roomsOn(3)) {
      const { x, y } = room.cell;
      for (const [dx, dy] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [0, 0]]) {
        expect(inside(path, [x + dx, y + dy]), `${room.id} ${dx},${dy}`).toBe(true);
      }
    }
  });

  it("traces deck 2 as an L of 6 points, and takes a deck as a string", () => {
    const path = hullFromRooms(index, "2");
    expect(path).toHaveLength(6);
    expect(area2(path)).toBeGreaterThan(0);
    expect(cornersOnly(path)).toBe(true);
    for (const room of roomsOn(2)) expect(inside(path, [room.cell.x, room.cell.y]), room.id).toBe(true);
    expect(boundsOf(path)).toEqual({ x0: -1.62, x1: 0.62, y0: 0.38, y1: 2.62 });
  });

  it("keeps squares that touch only at a corner apart, giving the largest piece", () => {
    const cells = [[0, 0], [1, 1], [2, 1]];
    const byId = new Map(cells.map(([x, y], i) => [`p.${i}`, { cell: { x, y, z: 1 }, blister: false }]));
    expect(hullFromRooms({ byId }, 1)).toEqual([[0.38, 0.38], [2.62, 0.38], [2.62, 1.62], [0.38, 1.62]]);
  });

  it("leaves blisters out, and gives nothing for a deck with no rooms", () => {
    expect(hullFromRooms(index, 1)).toEqual([]);
    expect(hullFromRooms(index, 7)).toEqual([]);
  });
});

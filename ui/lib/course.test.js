import { describe, expect, it } from "vitest";
import { courseCard, duration, plottedAgo } from "./course.js";

const AT = 1792828800000;
const msg = (over = {}) => ({ course: { to: "cinders", name: "The Cinders", km: 2000, seconds: 231, fuel: 6.4, ragged: false, at: AT, ...over } });
const docked = { docked: true, location: "tiss" };

describe("duration", () => {
  it("words seconds as the game does", () => {
    expect(duration(40)).toBe("40s");
    expect(duration(231)).toBe("3m 51s");
    expect(duration(3720)).toBe("1h 2m");
  });
});

describe("plottedAgo", () => {
  it("is just now under a minute, then minutes, hours and days", () => {
    expect(plottedAgo(59999)).toBe("just now");
    expect(plottedAgo(-5)).toBe("just now");
    expect(plottedAgo(4 * 60000)).toBe("4m ago");
    expect(plottedAgo(125 * 60000)).toBe("2h 5m ago");
    expect(plottedAgo(3 * 86400000 + 60000)).toBe("3d ago");
  });
});

describe("courseCard", () => {
  it("says where to and its figures, as the game words them", () => {
    expect(courseCard(msg(), docked, AT + 4 * 60000 + 1000)).toEqual({
      label: "Course for The Cinders",
      figures: "2,000 km · 3m 51s · 7 fuel",
      ragged: false,
      age: "plotted 4m ago",
    });
  });

  it("says a ragged course is ragged", () => {
    expect(courseCard(msg({ ragged: true }), docked, AT).ragged).toBe(true);
  });

  it("names a ship as the sweep had her", () => {
    expect(courseCard(msg({ to: "contact-2", name: "contact-2" }), docked, AT).label).toBe("Course for contact-2");
  });

  it("goes once she's under way, and shows stopped mid-trip or with no status", () => {
    expect(courseCard(msg(), { docked: false, destination: "cinders" }, AT)).toBe(null);
    expect(courseCard(msg(), { docked: false, stop: {} }, AT)).not.toBe(null);
    expect(courseCard(msg(), null, AT)).not.toBe(null);
  });

  it("is nothing with no course", () => {
    expect(courseCard({}, docked, AT)).toBe(null);
    expect(courseCard(null, docked, AT)).toBe(null);
    expect(courseCard({ course: { to: "" } }, docked, AT)).toBe(null);
  });

  it("leaves out what it wasn't sent", () => {
    const c = courseCard({ course: { to: "gannet", name: "gannet", ragged: false } }, docked, AT);
    expect(c.figures).toBe("");
    expect(c.age).toBe("");
  });
});

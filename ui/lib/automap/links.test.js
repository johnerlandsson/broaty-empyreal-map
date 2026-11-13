import { describe, it, expect } from "vitest";
import { createMap, addRoom, linkExit, toJSON, fromJSON } from "./graph.js";
import {
  addLink, deleteLink, setLinkOneWay, setLinkField, linkLabel, hasWay, linksOf,
  applyServerLinks, offersLinks,
} from "./links.js";

function three() {
  const m = createMap();
  const a = addRoom(m, { key: "A", name: "Rim" });
  const b = addRoom(m, { key: "B", name: "Hub" });
  const c = addRoom(m, { key: "C", name: "Mid" });
  return { m, a, b, c };
}

describe("links", () => {
  it("adds a link both ways, named alike, or one way", () => {
    const { m, a, b, c } = three();
    expect(addLink(m, a.id, b.id, { name: " Lift 12 " })).toBe(true);
    expect(a.links).toEqual({ [b.id]: { name: "Lift 12" } });
    expect(b.links).toEqual({ [a.id]: { name: "Lift 12" } });
    addLink(m, a.id, c.id, { cmd: "enter portal", oneWay: true });
    expect(a.links[c.id]).toEqual({ cmd: "enter portal" });
    expect(linksOf(c)).toEqual({});
  });

  it("refuses a link to itself or a missing room", () => {
    const { m, a } = three();
    expect(addLink(m, a.id, a.id)).toBe(false);
    expect(addLink(m, a.id, "99")).toBe(false);
    expect(a.links).toBeUndefined();
  });

  it("deletes both ways and leaves no empty links object", () => {
    const { m, a, b } = three();
    addLink(m, a.id, b.id);
    expect(deleteLink(m, a.id, b.id)).toBe(true);
    expect(a.links).toBeUndefined();
    expect(b.links).toBeUndefined();
    expect(deleteLink(m, a.id, b.id)).toBe(false);
  });

  it("toggles one-way, keeping the name", () => {
    const { m, a, b } = three();
    addLink(m, a.id, b.id, { name: "Lift 12" });
    expect(setLinkOneWay(m, a.id, b.id, true)).toBe(true);
    expect(linksOf(b)).toEqual({});
    expect(setLinkOneWay(m, a.id, b.id, false)).toBe(true);
    expect(b.links[a.id]).toEqual({ name: "Lift 12" });
  });

  it("sets a field both ways, and clears it", () => {
    const { m, a, b } = three();
    addLink(m, a.id, b.id);
    expect(setLinkField(m, a.id, b.id, "cmd", "ride")).toBe(true);
    expect(b.links[a.id].cmd).toBe("ride");
    expect(setLinkField(m, a.id, b.id, "cmd", "ride")).toBe(false);
    setLinkField(m, b.id, a.id, "cmd", "");
    expect(a.links[b.id]).toEqual({});
  });

  it("labels by name and destination", () => {
    const { m, a, b, c } = three();
    addLink(m, a.id, b.id, { name: "Lift 12" });
    addLink(m, a.id, c.id);
    expect(linkLabel(m, a.id, b.id)).toBe("Lift 12 → Hub");
    expect(linkLabel(m, a.id, c.id)).toBe("Mid");
  });

  it("knows a way by exit or link", () => {
    const { m, a, b, c } = three();
    linkExit(m, a.id, "n", b.id);
    addLink(m, b.id, c.id, { oneWay: true });
    expect(hasWay(m, a.id, b.id)).toBe(true);
    expect(hasWay(m, b.id, c.id)).toBe(true);
    expect(hasWay(m, c.id, b.id)).toBe(false);
  });
});

describe("offering a link (link_offers)", () => {
  it("auto offers until the server sends a links list, even an empty one", () => {
    const { m, a } = three();
    expect(offersLinks(m, "auto")).toBe(true);
    applyServerLinks(m, a, [], () => null);
    expect(offersLinks(m, "auto")).toBe(false);
    // Kept with the map.
    expect(offersLinks(fromJSON(toJSON(m)), "auto")).toBe(false);
  });

  it("a frame with no list says nothing", () => {
    const { m, a } = three();
    applyServerLinks(m, a, undefined, () => null);
    expect(offersLinks(m, "auto")).toBe(true);
  });

  it("always and never do as they say", () => {
    const { m, a } = three();
    expect(offersLinks(m, "never")).toBe(false);
    applyServerLinks(m, a, [], () => null);
    expect(offersLinks(m, "always")).toBe(true);
  });
});

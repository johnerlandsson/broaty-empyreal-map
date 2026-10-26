// @vitest-environment happy-dom
// ModelView's cutaway modes: Orrin cut away at the Exchange (Deck 2), its Deck 3 above the cut.

import { describe, expect, it } from "vitest";
import orrin from "../tests/fixtures/generated/orrin.js";
import { buildDecksModel, decksCut, decksKey, indexDecks } from "./lib/decks.js";
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

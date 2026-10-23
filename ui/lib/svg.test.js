import { describe, expect, it } from "vitest";
import { attachPanZoom } from "./svg.js";

// A stand-in for the band's div: records listeners and style, 100×100 px at the origin.
function fakeDiv() {
  const on = {};
  return {
    on,
    style: {},
    addEventListener: (type, fn) => (on[type] ??= []).push(fn),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    setPointerCapture() {},
    fire(type, e = {}) {
      const ev = { target: { closest: () => null }, preventDefault() { ev.prevented = true; }, ...e };
      for (const fn of on[type] ?? []) fn(ev);
      return ev;
    },
  };
}

function panned() {
  const div = fakeDiv();
  let vb = [0, 0, 100, 100];
  attachPanZoom(div, () => vb, (v) => (vb = v), { minW: 10, maxW: 1000 });
  return { div, vb: () => vb };
}

describe("attachPanZoom", () => {
  it("pans while the primary button is held, and stops on release", () => {
    const { div, vb } = panned();
    div.fire("pointerdown", { button: 0, buttons: 1, clientX: 50, clientY: 50, pointerId: 1 });
    div.fire("pointermove", { buttons: 1, clientX: 40, clientY: 50 });
    expect(vb()).toEqual([10, 0, 100, 100]);
    div.fire("pointerup", { button: 0, buttons: 0, clientX: 40, clientY: 50 });
    div.fire("pointermove", { buttons: 0, clientX: 0, clientY: 50 });
    expect(vb()).toEqual([10, 0, 100, 100]);
  });

  it("stops the native drag and selection a press would start (WebKit's image drag)", () => {
    const { div } = panned();
    expect(div.fire("pointerdown", { button: 0, buttons: 1, clientX: 5, clientY: 5 }).prevented).toBe(true);
    expect(div.fire("dragstart").prevented).toBe(true);
    expect(div.fire("selectstart").prevented).toBe(true);
    expect(div.style.userSelect).toBe("none");
    expect(div.style.webkitUserDrag).toBe("none");
  });

  it("lets go once the button is up, even if the release never reached it", () => {
    const { div, vb } = panned();
    div.fire("pointerdown", { button: 0, buttons: 1, clientX: 50, clientY: 50 });
    div.fire("pointermove", { buttons: 0, clientX: 20, clientY: 50 }); // the pointerup went elsewhere
    expect(vb()).toEqual([0, 0, 100, 100]);
  });

  it("lets go when it loses the pointer or a native drag takes over", () => {
    for (const lost of ["lostpointercapture", "dragstart", "pointercancel"]) {
      const { div, vb } = panned();
      div.fire("pointerdown", { button: 0, buttons: 1, clientX: 50, clientY: 50 });
      div.fire(lost);
      div.fire("pointermove", { buttons: 1, clientX: 20, clientY: 50 });
      expect(vb(), lost).toEqual([0, 0, 100, 100]);
    }
  });

  it("doesn't pan on a right-click (its release goes to the context menu)", () => {
    const { div, vb } = panned();
    const down = div.fire("pointerdown", { button: 2, buttons: 2, clientX: 50, clientY: 50 });
    expect(down.prevented).toBeUndefined();
    div.fire("pointermove", { buttons: 2, clientX: 20, clientY: 50 });
    expect(vb()).toEqual([0, 0, 100, 100]);
  });
});

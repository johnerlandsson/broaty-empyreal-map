import { describe, it, expect, vi } from "vitest";
import { landLoad, landSaver } from "./land-save.js";
import { LandStore } from "./land-store.js";

const store = (who = "ada") => ({ who, record: () => ({ v: 1 }) });

describe("landSaver", () => {
  it("saves once, a debounce after the last change", () => {
    vi.useFakeTimers();
    const post = vi.fn();
    const s = landSaver(store(), post, 1000);
    s.soon();
    vi.advanceTimersByTime(600);
    s.soon();
    vi.advanceTimersByTime(600);
    expect(post).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith("ada", { v: 1 });
    vi.useRealTimers();
  });

  it("now saves at once and cancels the waiting save", () => {
    vi.useFakeTimers();
    const post = vi.fn();
    const s = landSaver(store(), post, 1000);
    s.soon();
    s.now();
    expect(post).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2000);
    expect(post).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("flush saves only a waiting save", () => {
    vi.useFakeTimers();
    const post = vi.fn();
    const s = landSaver(store(), post, 1000);
    s.flush();
    expect(post).not.toHaveBeenCalled();
    s.soon();
    s.flush();
    expect(post).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("saves nothing while there is no character", () => {
    vi.useFakeTimers();
    const post = vi.fn();
    const s = landSaver(store(null), post, 1000);
    s.now();
    s.soon();
    vi.advanceTimersByTime(2000);
    expect(post).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

const frame = (id) => ({ id, name: id, coords: { x: 0, y: 0 }, exits: {} });

describe("landLoad", () => {
  it("saves the one before's waiting change under her name before the next one's map loads", () => {
    vi.useFakeTimers();
    const posts = [];
    const store = new LandStore();
    const saver = landSaver(store, (who, record) => posts.push([who, record.places.map((p) => p.id)]), 1000);
    store.onChange(() => saver.soon());
    landLoad(store, saver, { who: "ada", record: null });
    vi.advanceTimersByTime(2000);
    posts.length = 0;
    store.ingest(frame("a1"));
    landLoad(store, saver, { who: "bea", record: null });
    expect(posts).toEqual([["ada", ["a1"]]]);
    expect(store.who).toBe("bea");
    expect(store.places()).toEqual([]);
    vi.advanceTimersByTime(2000);
    expect(posts.at(-1)).toEqual(["bea", []]);
    vi.useRealTimers();
  });

  it("on no one, saves what's waiting and clears the map, notes and where you are", () => {
    vi.useFakeTimers();
    const posts = [];
    const store = new LandStore();
    const saver = landSaver(store, (who, record) => posts.push([who, record.places.map((p) => p.id)]), 1000);
    store.onChange(() => saver.soon());
    landLoad(store, saver, { who: "ada", record: null });
    vi.advanceTimersByTime(2000);
    posts.length = 0;
    store.ingest(frame("a1"));
    store.setNote("a1", "camp");
    landLoad(store, saver, { who: undefined });
    expect(posts).toEqual([["ada", ["a1"]]]);
    expect(store.who).toBe(null);
    expect(store.here).toBe(null);
    expect(store.places()).toEqual([]);
    vi.advanceTimersByTime(2000);
    expect(posts.length).toBe(1); // nothing saved for no one
    vi.useRealTimers();
  });

  it("keeps a frame walked while no one's map was loaded as where you are in the next one's", () => {
    const store = new LandStore();
    const saver = landSaver(store, () => {}, 1000);
    landLoad(store, saver, { who: "ada", record: null });
    landLoad(store, saver, {});
    store.ingest(frame("b1"));
    landLoad(store, saver, { who: "bea", record: { v: 1, places: [{ id: "b0", name: "B0", x: 1, y: 1, z: 0, exits: {} }] } });
    expect(store.here).toBe("b1");
    expect(store.places().map((p) => p.id)).toEqual(["b0", "b1"]);
  });

  it("ignores a message that isn't one", () => {
    const store = new LandStore();
    const saver = landSaver(store, () => {}, 1000);
    landLoad(store, saver, { who: "ada", record: null });
    expect(landLoad(store, saver, { who: 3 })).toBe(false);
    expect(store.who).toBe("ada");
  });
});

describe("saving and walking", () => {
  it("a step into a place already walked as it was saves nothing", () => {
    vi.useFakeTimers();
    const post = vi.fn();
    const store = new LandStore();
    const saver = landSaver(store, post, 1000);
    store.onChange(() => saver.soon());
    landLoad(store, saver, { who: "ada", record: null });
    store.ingest(frame("a1"));
    store.ingest(frame("a2"));
    vi.advanceTimersByTime(2000);
    post.mockClear();
    store.ingest(frame("a1"));
    vi.advanceTimersByTime(2000);
    expect(store.here).toBe("a1");
    expect(post).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

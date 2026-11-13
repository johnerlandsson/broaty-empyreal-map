import { describe, it, expect, vi } from "vitest";
import { landSaver } from "./land-save.js";

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

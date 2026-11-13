// Saving the walked land: debounced after walking, at once after a note or a forget, and flushed
// when the panel is hidden, so nothing waits out the debounce and is lost.

/**
 * @param {{ who: string|null, record(): object }} store
 * @param {(who: string, record: object) => void} post
 * @param {number} ms the debounce
 */
export function landSaver(store, post, ms = 1000) {
  let timer = 0;
  const now = () => {
    clearTimeout(timer);
    timer = 0;
    if (store.who === null) return; // no character yet: the map waits for land-load
    post(store.who, store.record());
  };
  return {
    soon() {
      clearTimeout(timer);
      timer = setTimeout(now, ms);
    },
    now,
    /** Save now only if a debounced save is waiting. */
    flush() {
      if (timer) now();
    },
  };
}

/**
 * A "land-load" message into the store. No one (who null, after a disconnect): the waiting save goes
 * out under the character it was for, then the map is cleared. Another character: the one before's
 * waiting save goes out under her name first, then the new one's map loads (merged with what's been
 * walked while no one's map was loaded). False for a message that isn't one.
 * @param {import("./land-store.js").LandStore} store
 * @param {{ flush(): void }} saver landSaver's
 * @param {{ who?: string|null, record?: object }} msg
 */
export function landLoad(store, saver, msg) {
  const who = msg?.who;
  if (who == null) {
    saver.flush();
    store.clear();
    return true;
  }
  if (typeof who !== "string") return false;
  if (who !== store.who) saver.flush();
  store.load(who, msg.record);
  return true;
}

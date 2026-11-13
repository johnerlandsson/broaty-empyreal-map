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

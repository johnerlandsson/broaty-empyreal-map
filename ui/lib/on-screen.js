// Whether the panel is on screen, for the animation loops (the space scene's frames, the glow's
// breath, the chart's and the sky's redraws). A hidden tab sets document.hidden, but Mallard keeps a
// panel on a background tab mounted with its iframe display:none, where document.hidden stays false
// and requestAnimationFrame and timers run on. So the page's root is also watched against the top
// viewport (an IntersectionObserver with no root): an iframe with display:none lays nothing out, and
// its root reads as not intersecting. Until the observer's first word the panel counts as on screen.

const watchers = [];
let intersecting = true;
let was = true;

/** True while the panel can be seen: its tab not hidden and its frame not display:none. */
export const onScreen = () => !document.hidden && intersecting;

/** Call fn() each time the panel goes on or off screen, as a visibilitychange listener was. */
export function onScreenChange(fn) {
  watchers.push(fn);
}

function changed() {
  const now = onScreen();
  if (now === was) return;
  was = now;
  for (const fn of watchers) fn();
}

if (typeof document !== "undefined") {
  was = onScreen();
  document.addEventListener("visibilitychange", changed);
  if (typeof IntersectionObserver === "function") {
    new IntersectionObserver((entries) => {
      intersecting = entries[entries.length - 1].isIntersecting;
      changed();
    }).observe(document.documentElement);
  }
}

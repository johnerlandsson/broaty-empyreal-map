// One draw a frame. A view's setters ask for a redraw with drawSoon(view); in the panel (main.js
// calls deferDraws()) every view asked for is drawn once, at the next animation frame, however many
// messages that frame brought (the replay after "ready" sets each view several times). A view used
// on its own (the tests, the preview, the editor) draws at once, as it always did.
// Each view's draw() starts with drawing(this, t), so a draw by any path (a message's, a timer's, a
// pan's, a resize's) does for one waiting, and drawEvery()'s timer knows when it last drew.

const dirty = new Set();
const drawnAt = new WeakMap(); // view -> wall-clock ms of its last draw
let frame = 0;
let deferring = false;

/** Redraw the view at the next frame (in the panel), or now. */
export function drawSoon(view) {
  if (!deferring) return view.draw(Date.now());
  dirty.add(view);
  if (!frame) frame = requestAnimationFrame(drawDirty);
}

/** Called by a view's draw(t) first: a redraw it had waiting is done by this one. */
export function drawing(view, t) {
  dirty.delete(view);
  drawnAt.set(view, t);
}

/** When the view last drew (wall-clock ms), or -Infinity. */
export const lastDrawn = (view) => drawnAt.get(view) ?? -Infinity;

function drawDirty() {
  frame = 0;
  const t = Date.now();
  for (const view of [...dirty]) {
    dirty.delete(view);
    try {
      view.draw(t);
    } catch (e) {
      setTimeout(() => {
        throw e; // reported as uncaught, as a setter's own draw was, without stopping the other views
      });
    }
  }
}

/** Keep the view drawn: a redraw `ms` after its last draw, whoever drew it (a message's draw puts
 *  the next off). Returns the function that stops it. */
export function drawEvery(view, ms) {
  let timer = 0;
  const tick = () => {
    const wait = lastDrawn(view) + ms - Date.now();
    if (wait <= 0) view.draw(Date.now());
    timer = setTimeout(tick, wait > 0 ? wait : ms);
  };
  timer = setTimeout(tick, ms);
  return () => clearTimeout(timer);
}

/** From now on drawSoon() waits for the next frame. */
export function deferDraws() {
  deferring = true;
}

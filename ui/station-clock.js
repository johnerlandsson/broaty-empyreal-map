// Station time, as a small tab on the rule between the bands, at the right: "13:52". It's the
// panel's, not either map's, so it shows over every plan and scene, the same size at any zoom. The
// clock is the client's, read in UTC. It turns with the minute on a timer that wakes as each goes.

import { stationTime } from "./lib/clock.js";

export class StationClock {
  /** @param {HTMLElement} frameEl the panel (main.station) */
  constructor(frameEl) {
    const div = document.createElement("div");
    div.className = "station-clock";
    frameEl.appendChild(div);
    this.div = div;
    this.timer = 0;
    this.tick();
  }

  /** Show the time now, and come back as the minute turns. */
  tick(now = Date.now()) {
    const { time, ms } = stationTime(now);
    this.div.textContent = time;
    this.timer = setTimeout(() => this.tick(), ms);
  }

  remove() {
    clearTimeout(this.timer);
    this.div.remove();
  }
}

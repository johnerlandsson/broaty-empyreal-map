// Station time and its shift, as a small tab on the rule between the bands, at the right:
// "13:52 · first shift". It's the panel's, not either map's, so it shows over every plan and scene,
// the same size at any zoom. People, counters and the tug keep station time (help people), and the
// clock is the client's, read in UTC. It turns with the minute on a timer that wakes as each goes.

import { stationTime } from "./lib/clock.js";

export class StationClock {
  /** @param {HTMLElement} frameEl the panel (main.station) */
  constructor(frameEl) {
    const div = document.createElement("div");
    div.className = "station-clock";
    div.innerHTML = '<b class="time"></b> · <span class="shift"></span>';
    frameEl.appendChild(div);
    this.div = div;
    this.timeEl = div.querySelector(".time");
    this.shiftEl = div.querySelector(".shift");
    this.timer = 0;
    this.tick();
  }

  /** Show the time now, and come back as the minute turns. */
  tick(now = Date.now()) {
    const { time, shift, ms } = stationTime(now);
    this.timeEl.textContent = time;
    this.shiftEl.textContent = shift;
    this.timer = setTimeout(() => this.tick(), ms);
  }

  remove() {
    clearTimeout(this.timer);
    this.div.remove();
  }
}

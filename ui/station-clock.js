// Station time, as a small tab on the rule between the bands, at the right: "Wed 13:52", and on
// Tamsin's ports where the sun is, "Wed 17:26 · dusk" (picked 2026-10-26, option B of
// docs/maps/reference/station-clock-day-options.png), as the game's `time` says them. It's the
// panel's, not either map's, so it shows over every plan and scene, the same size at any zoom. It's
// Empyreal time, from the game's Empyreal.Clock (lib/clock.js), turning with each Empyreal minute
// (about 10.6 real seconds) on a timer that wakes as each goes; the sun is worked out from the charts
// as ground.ts does (lib/sky.js). Hidden till the first clock comes, and again when the Lua side
// clears it at a disconnect: there's no other time to show.

import { stationTime } from "./lib/clock.js";
import { groundSky, sunPhase } from "./lib/sky.js";

export class StationClock {
  /** @param {HTMLElement} frameEl the panel (main.station) */
  constructor(frameEl) {
    const div = document.createElement("div");
    div.className = "station-clock";
    div.hidden = true;
    this.day = document.createTextNode("");
    this.time = document.createElement("b");
    this.sun = document.createTextNode("");
    div.append(this.day, this.time, this.sun);
    frameEl.appendChild(div);
    this.div = div;
    this.timer = 0;
    this.clock = null;
    this.charts = null;
    this.port = null;
  }

  /** The clock message: { clock: { weekday, day, midnight, dayMs } }, or {} for none. */
  set(msg) {
    this.clock = msg?.clock ?? null;
    this.tick();
  }

  /** The port you're on (its charts id, "zennor") and the charts that place it, or null off one. */
  setPort(charts, port) {
    this.charts = port ? charts ?? null : null;
    this.port = port ?? null;
    this.tick();
  }

  /** Show the time now, and come back as the minute turns; hide with no clock. */
  tick(now = Date.now()) {
    clearTimeout(this.timer);
    this.timer = 0;
    const t = stationTime(this.clock, now);
    this.div.hidden = !t;
    if (!t) return;
    const sky = this.charts && this.port ? groundSky(this.charts, this.port, now) : null;
    this.day.data = `${t.weekday[0].toUpperCase()}${t.weekday.slice(1, 3)} `;
    this.time.textContent = t.time;
    this.sun.data = sky ? ` · ${sunPhase(sky.sun.alt, sky.sun.rising)}` : "";
    this.timer = setTimeout(() => this.tick(), t.ms);
  }

  remove() {
    clearTimeout(this.timer);
    this.div.remove();
  }
}

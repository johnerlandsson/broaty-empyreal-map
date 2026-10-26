// Station time: UTC, as the game keeps it (server 752aa12), and its shift as help people words it:
// first shift 06:00 to 14:00, second 14:00 to 22:00, the night watch otherwise. The client's own
// clock, read in UTC; the game sends nothing for it.

const MINUTE = 60000;

/**
 * @param {number | Date} now ms since the epoch, or a Date
 * @returns {{ time: string, shift: string, ms: number }} "13:52", "first shift", and ms until the minute turns
 */
export function stationTime(now) {
  const d = new Date(now);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const shift = h >= 6 && h < 14 ? "first shift" : h >= 14 && h < 22 ? "second shift" : "night watch";
  const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return { time, shift, ms: MINUTE - (d.getTime() % MINUTE) };
}

// Station time: UTC, as the game keeps it (server 752aa12). The client's own clock, read in UTC; the
// game sends nothing for it. No shift: first, second and the night watch are T.I.S.S.'s own, and
// other stations and peoples keep other days, as the maintainer has it.

const MINUTE = 60000;

/**
 * @param {number | Date} now ms since the epoch, or a Date
 * @returns {{ time: string, ms: number }} "13:52", and ms until the minute turns
 */
export function stationTime(now) {
  const d = new Date(now);
  const time = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  return { time, ms: MINUTE - (d.getTime() % MINUTE) };
}

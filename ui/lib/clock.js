// Station time: Empyreal time (empyreal gmcp.md §8.8, time.md §3), Tamsin's solar day, about 4.2
// real hours, so a minute is about 10.6 real seconds. The game sends Empyreal.Clock at login, at
// each midnight and after a restart: today's weekday, `midnight`, the wall-clock ms it began, and
// `dayMs`, how long it is. The time is a 24-hour day's share of (now - midnight) / dayMs, run here on
// the client's own clock; a few seconds between it and the server's is less than a minute. Past the
// next midnight before the next message, the weekday moves on here. No shift: first, second and the
// night watch are T.I.S.S.'s own, and other stations and peoples keep other days, as the maintainer
// has it.

const DAY_MINUTES = 24 * 60;
export const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const finite = (v) => typeof v === "number" && Number.isFinite(v);

/**
 * @param {{ weekday: string, midnight: number, dayMs: number } | null | undefined} clock the
 *   clock message's `clock`
 * @param {number | Date} now wall-clock ms, or a Date
 * @returns {{ time: string, weekday: string, ms: number } | null} "13:52", its weekday
 *   ("wednesday"), and ms until the Empyreal minute turns; null with no clock that can run
 */
export function stationTime(clock, now) {
  const start = WEEKDAYS.indexOf(String(clock?.weekday).toLowerCase());
  if (start < 0 || !finite(clock.midnight) || !(finite(clock.dayMs) && clock.dayMs > 0)) return null;
  const minuteMs = clock.dayMs / DAY_MINUTES;
  // A hair over, as the game's own clock.ts does, so a minute's own ms is that minute.
  const minutes = Math.floor((+now - clock.midnight) / minuteMs + 1e-6);
  const days = Math.floor(minutes / DAY_MINUTES);
  const m = minutes - days * DAY_MINUTES;
  const time = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const weekday = WEEKDAYS[(((start + days) % 7) + 7) % 7];
  const ms = Math.max(1, Math.ceil(clock.midnight + (minutes + 1) * minuteMs - +now));
  return { time, weekday, ms };
}

// What the plan's card shows of the action message (src/station_map/action.lua): the label, its
// stage of how many and what waits behind it, and the seconds left and how much of the bar is
// still lit, counted down here from the action's end (the game sends no countdown). And what it
// shows of the clearance message, her waiting on Control.

/**
 * @param {{ action?: { label: string, stage: number, stages: number, ends?: number, total?: number, queued: number } }} msg
 * @param {number} now ms since the epoch
 * @returns {{ label: string, detail: string, seconds: number | null, fraction: number | null, ms: number | null } | null}
 */
export function actionCard(msg, now) {
  const a = msg?.action;
  if (!a || typeof a !== "object" || typeof a.label !== "string" || a.label === "") return null;
  const parts = [];
  if (a.stages > 1) parts.push(`stage ${a.stage} of ${a.stages}`);
  if (a.queued > 0) parts.push(`${a.queued} waiting`);
  const detail = parts.join(" · ");
  if (typeof a.ends !== "number" || typeof a.total !== "number") return { label: a.label, detail, seconds: null, fraction: null, ms: null };
  const ms = Math.max(0, a.ends * 1000 - now);
  const fraction = a.total > 0 ? Math.min(1, ms / (a.total * 1000)) : 0;
  return { label: a.label, detail, seconds: Math.ceil(ms / 1000), fraction, ms };
}

/**
 * What the card shows of the clearance message (src/station_map/clearance.lua) while she waits on
 * Control's answer to a dock or an undock, a landing or a lift-off: "awaiting clearance · T.I.S.S.",
 * the place as her status names it. The game sends no countdown, so it has no time and no bar.
 * @param {{ verb?: string | null, at?: string }} msg
 * @returns {{ label: string, detail: string, seconds: null, fraction: null, ms: null } | null}
 */
export function clearanceCard(msg) {
  if (msg?.verb !== "dock" && msg?.verb !== "undock") return null;
  const at = typeof msg.at === "string" ? msg.at.trim() : "";
  return { label: at ? `awaiting clearance · ${at}` : "awaiting clearance", detail: "", seconds: null, fraction: null, ms: null };
}

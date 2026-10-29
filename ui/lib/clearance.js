// What the deck band's corner card shows of the clearance message (src/station_map/clearance.lua):
// her waiting on Control.

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

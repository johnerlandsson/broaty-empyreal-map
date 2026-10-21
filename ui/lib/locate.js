// Turn a Lua `location` message into a position on the model / deck plan.
// Pure and total: locate() never throws, whatever shape the message has.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const isObj = (v) => v !== null && typeof v === "object";
const str = (v) => (typeof v === "string" && v !== "" ? v : null);

/** @returns {{byId: Map<string, object>, corridors: {0: object[], 1: object[], 2: object[]}}} */
export function indexStation(station) {
  const byId = new Map();
  const corridors = { 0: [], 1: [], 2: [] };
  for (const room of station?.rooms ?? []) {
    byId.set(room.id, room);
    if ((room.terrain === "corridor" || room.terrain === "lobby") && corridors[room.z]) {
      corridors[room.z].push(room);
    }
  }
  for (const z of [0, 1, 2]) corridors[z].sort((a, b) => a.x - b.x);
  return { byId, corridors };
}

function levelOf(index, id) {
  const z = index.byId.get(id)?.z;
  return Number.isInteger(z) && z >= 0 && z <= 3 ? z : null;
}

function locateLift(index, lift, prevLevel) {
  const m = /^tiss\.lift-(\d+)$/.exec(str(lift.id) ?? "");
  if (!m) return null;
  const hour = Number(m[1]) % 12;
  const prev = Number.isInteger(prevLevel) ? clamp(prevLevel, 0, 3) : null;

  const at = str(lift.at);
  const atLevel = at ? levelOf(index, at) : null;
  if (at && atLevel !== null) {
    return { kind: "lift", hour, leg: Math.min(atLevel, 2), level: atLevel, atId: at };
  }

  if (Array.isArray(lift.between)) {
    const la = levelOf(index, lift.between[0]);
    const lb = levelOf(index, lift.between[1]);
    const known = [la, lb].filter((l) => l !== null);
    if (known.length > 0) {
      const leg = Math.min(Math.min(...known), 2);
      return { kind: "lift", hour, leg, level: prev ?? la ?? lb, atId: null };
    }
  }

  const level = prev ?? 0;
  return { kind: "lift", hour, leg: Math.min(level, 2), level, atId: null };
}

/**
 * @param {ReturnType<typeof indexStation>} index
 * @param {object|null|undefined} msg location message from the Lua side
 * @param {number|null} prevLevel level the plan was last showing
 */
export function locate(index, msg, prevLevel) {
  try {
    if (!isObj(msg)) return { kind: "off", name: "" };
    if (isObj(msg.lift)) {
      const w = locateLift(index, msg.lift, prevLevel);
      if (w) return w;
    }
    const room = typeof msg.roomId === "string" ? index.byId.get(msg.roomId) : undefined;
    if (room && levelOf(index, room.id) !== null) {
      return { kind: "room", id: room.id, level: room.z, x: room.x, y: room.y };
    }
    return { kind: "off", name: str(msg.name) ?? "" };
  } catch {
    return { kind: "off", name: "" };
  }
}

/** Model face key for the player's location, or null when off the station. */
export function keyOf(where) {
  if (!where) return null;
  if (where.kind === "lift") return `spoke:${where.hour}:${where.leg}`;
  if (where.kind !== "room") return null;
  if (where.level === 3) return where.id;
  if (where.id.includes("ladderway")) return `spoke:${(where.x - 1) / 2}:${where.level}`;
  return `r${where.level}:${where.x}:${clamp(where.y, -2, 2)}`;
}

export function infoLine(where, msg, index) {
  try {
    const m = isObj(msg) ? msg : {};
    if (!where || where.kind === "off") return (str(where?.name) ?? str(m.name) ?? "").toUpperCase();

    if (where.kind === "lift") {
      const head = `LIFT ${where.hour === 0 ? 12 : where.hour}`;
      if (where.atId) {
        const floor = index?.byId?.get(where.atId)?.name ?? where.atId;
        return `${head} · at ${floor}`;
      }
      const heading = str(m.lift?.heading);
      if (heading === "hubward") return `${head} · climbing hubward`;
      if (heading === "rimward") return `${head} · descending rimward`;
      return head;
    }

    const room = index?.byId?.get(where.id);
    const name = str(m.name) ?? str(room?.name) ?? "";
    const address = str(m.address) ?? str(room?.address);
    const g = m.gravity ?? room?.gravity;
    const parts = [name.toUpperCase()];
    if (address && address.toLowerCase() !== name.toLowerCase()) parts.push(address);
    if (g !== undefined && g !== null) parts.push(`${String(g)} g`);
    return parts.join(" · ");
  } catch {
    return "";
  }
}

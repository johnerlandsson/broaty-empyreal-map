// Cars: the rooms that move, a T.I.S.S. spoke lift and Zennor's tram. Aboard one, the bottom band
// shows the car itself, as it shows a one-room ship, with a line of its stops under it: where it
// is, which way it's going, its doors. What the game sends is the car's kind, its stops bottom to
// top, the stop it's at or the two it's between, its doors and its heading; never how far along,
// so between two stops the car is drawn midway. Everything here is the drawing's layout and
// words; car-deck.js draws it. Pure; no DOM.

/** Each kind's car, in plan units: its size, its name where the game sends none, its words. */
export const CARS = {
  lift: { w: 130, h: 130, name: "Lift", moving: { hubward: "climbing hubward", rimward: "descending rimward" } },
  tram: { w: 300, h: 96, name: "The Tram", moving: { uphill: "uphill", downhill: "downhill" } },
};

/** The kind of car a location message's `lift` is: its own, else a lift (as before the tram). */
export function carKind(lift) {
  return CARS[lift?.kind] ? lift.kind : "lift";
}

const RINGS = ["Rim", "Mid", "Inner", "Hub"];

/**
 * What to call a stop: its room's name on the plan (`full`), and on the line of stops (`short`),
 * a T.I.S.S. floor its ring ("Mid"), a station of the tram without " Station" ("Market"). The
 * game's name for it where the plan has no room.
 * @param {{byId?: Map<string, object>}|null|undefined} index the station's index
 */
export function stopNames(index) {
  const room = (id) => index?.byId?.get(id) ?? null;
  return {
    full: (floor) => room(floor?.id)?.name ?? floor?.name ?? floor?.id ?? "",
    short: (floor) => {
      const r = room(floor?.id);
      if (r && Number.isInteger(r.z) && (r.terrain === "lobby" || r.terrain === "hub")) return RINGS[r.z] ?? r.name;
      return (r?.name ?? floor?.name ?? floor?.id ?? "").replace(/ Station$/, "");
    },
  };
}

/** The car's name: the game's ("Lift 9"), else the plan's (the tram's, from its cars), else its kind's. */
export function carName(msg, index) {
  const lift = msg?.lift;
  const named = index?.cars?.find?.((c) => c.id === lift?.id)?.name;
  return (typeof msg?.name === "string" && msg.name !== "" ? msg.name : null) ?? named ?? CARS[carKind(lift)].name;
}

/**
 * The line of stops, `width` wide and centred on 0: a dot a stop, bottom to top left to right,
 * each with its short name; and the car, on its stop, or midway between the two it's between,
 * pointing the way it's going (+1 right, towards the top stop, or -1). No car if the message
 * puts it nowhere on the line.
 */
export function stopLine(lift, names, width) {
  const floors = Array.isArray(lift?.floors) ? lift.floors : [];
  const n = floors.length;
  const xOf = (i) => (n > 1 ? -width / 2 + (width * i) / (n - 1) : 0);
  const stops = floors.map((f, i) => ({ id: f.id, x: xOf(i), name: names.short(f) }));
  const at = floors.findIndex((f) => f.id === lift?.at);
  const between = Array.isArray(lift?.between) ? lift.between.map((id) => floors.findIndex((f) => f.id === id)) : [];
  let car = null;
  if (at >= 0) car = { x: xOf(at), dir: 0 };
  else if (between.length === 2 && between.every((i) => i >= 0)) {
    car = { x: (xOf(between[0]) + xOf(between[1])) / 2, dir: Math.sign(between[1] - between[0]) };
  }
  return { stops, car };
}

/**
 * What the car's doing, in its own words: "at Market, doors open", "uphill, Market → Uptown",
 * "climbing hubward, Rim → Mid", or "" when the message doesn't say.
 */
export function carDoing(lift, names) {
  const floors = Array.isArray(lift?.floors) ? lift.floors : [];
  const floor = (id) => floors.find((f) => f.id === id) ?? { id };
  const words = CARS[carKind(lift)].moving;
  if (typeof lift?.at === "string" && lift.at !== "") {
    return `at ${names.short(floor(lift.at))}${lift.doors === "open" ? ", doors open" : ""}`;
  }
  const way = words[lift?.heading] ?? null;
  if (Array.isArray(lift?.between) && lift.between.length === 2) {
    const [a, b] = lift.between.map((id) => names.short(floor(id)));
    return way ? `${way}, ${a} → ${b}` : `${a} → ${b}`;
  }
  return way ?? "";
}

/** The info line aboard a car: `THE TRAM · uphill, Market → Uptown`, `LIFT 9 · at Main Concourse`. */
export function carInfo(msg, index) {
  try {
    const lift = msg?.lift;
    const names = stopNames(index);
    const head = carName(msg, index).toUpperCase();
    // at a stop the line names it in full, as the plan does; the car's drawing has the short name
    const doing =
      typeof lift?.at === "string" && lift.at !== ""
        ? `at ${names.full((lift.floors ?? []).find((f) => f.id === lift.at) ?? { id: lift.at })}`
        : carDoing(lift, names);
    return doing ? `${head} · ${doing}` : head;
  } catch {
    return "";
  }
}

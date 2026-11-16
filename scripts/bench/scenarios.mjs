// The bench's fixed idle scenarios (docs/maps/bench.md), as session files for scripts/bench/replay.lua:
// GMCP frames from the game's own recorded payloads (dev/charts-cases.json, tests/fixtures/sample.mallardlog),
// with the panel's own toggles as `panel` records. The real Lua plugin turns each into the panel's
// messages; a `mark` record "window" starts the measured 30 s (what follows it is part of the window).
// Each scenario's clock is its case's `now`.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const CASES = JSON.parse(readFileSync(`${root}dev/charts-cases.json`, "utf8")).cases;
const SAMPLE = readFileSync(`${root}tests/fixtures/sample.mallardlog`, "utf8")
  .split("\n")
  .flatMap((l) => {
    try {
      const r = JSON.parse(l);
      return r?.event?.kind === "gmcp" ? [r.event] : [];
    } catch {
      return [];
    }
  });
const sample = (pkg, id) => {
  const e = SAMPLE.find((s) => s.package === pkg && s.data?.id === id);
  if (!e) throw new Error(`bench: no ${pkg} ${id} in tests/fixtures/sample.mallardlog`);
  return e.data;
};

const gmcp = (pkg, data) => ({ kind: "protocol", event: { kind: "gmcp", package: pkg, data } });
const panel = (name, data) => ({ kind: "panel", name, data });
const WINDOW = { kind: "mark", name: "window" };

const CHAR = gmcp("Char.Status", { name: "Bench" });
const COCKPIT = gmcp("mudstd.room.info", sample("mudstd.room.info", "ship.41"));
const CONCOURSE = [gmcp("mudstd.room.info", sample("mudstd.room.info", "tiss.concourse")), gmcp("Empyreal.Room", sample("Empyreal.Room", "tiss.concourse"))];
const LADDERWAY_9 = gmcp("mudstd.room.info", sample("mudstd.room.info", "tiss.ladderway-9-rim"));
const SQUARE = gmcp("mudstd.room.info", { area: "zennor", areaName: "Zennor", exits: {}, id: "zennor.square", name: "The Square" });

/** A case's frames as the game sent them: charts, then her status, course and sweep. */
function ship(name, status = CASES[name].status) {
  const c = CASES[name];
  return [gmcp("Space.Charts", c.charts), gmcp("Ship.Status", status), gmcp("Ship.Course", c.course), gmcp("Space.Contacts", c.contacts)];
}

// In the Senara lane out of Maelor: the game's status at the mouth, then her under way in it.
const IN_LANE = { ...CASES["maelor-mouth"].status, status: "in the Senara lane 40%", location: null, destination: "mouth:senara:maelor", progress: 0.4, eta: 300 };

export const SCENARIOS = [
  { name: "tiss-standing", note: "on foot on T.I.S.S., the concourse", now: CASES["docked-tiss"].now, records: [CHAR, ...CONCOURSE, WINDOW] },
  { name: "travelling", note: "aboard, under way to Orrin Station", now: CASES["under-way-orrin"].now, records: [CHAR, COCKPIT, ...ship("under-way-orrin"), WINDOW] },
  { name: "chart-parked", note: "aboard at Gannet Belt, the chart open", now: CASES["at-gannet"].now, records: [CHAR, COCKPIT, ...ship("at-gannet"), panel("chart", { on: true }), WINDOW] },
  {
    name: "lanes-in-lane",
    note: "aboard in the Senara lane, the lanes map open",
    now: CASES["maelor-mouth"].now,
    records: [CHAR, COCKPIT, ...ship("maelor-mouth"), gmcp("Ship.Status", IN_LANE), panel("lanes-view", { on: true }), WINDOW],
  },
  { name: "zennor-sky", note: "on foot in Zennor's square, its sky", now: CASES["landed-zennor"].now, records: [CHAR, gmcp("Space.Charts", CASES["landed-zennor"].charts), SQUARE, WINDOW] },
  { name: "tiss-turn", note: "T.I.S.S., a walk from 12:00 to 9:00 turning the model", now: CASES["docked-tiss"].now, records: [CHAR, ...CONCOURSE, WINDOW, LADDERWAY_9] },
  { name: "background-tab", note: "travelling, the panel's iframe display:none (document.hidden false)", now: CASES["under-way-orrin"].now, hidden: true, records: [CHAR, COCKPIT, ...ship("under-way-orrin"), WINDOW] },
];

/** A scenario as a session file for replay.lua: every record at its case's `now`. */
export function sessionText(s) {
  return s.records.map((r) => JSON.stringify({ ...r, t: s.now })).join("\n") + "\n";
}

// Wenna Halt's six rooms, from content/areas/wenna.yaml in the Empyreal source. Like Orrin's, the
// area has no layout (no addresses or coords), so the places here are read off its exits and
// descriptions: one drum at 0.6 g, the Concourse a carpeted hall curving round it, the Exchange
// north (fore) of it, the Freight Office south (aft), the Berths east, the Chart Office west, and
// the Lounge up a ramp near the axis, at 0.2 g.
//
// x runs west to east along the hall, y south to north; `hour` is the room's place round the
// drum for the model (12:00 is the Concourse), `band` its place along the axis (-1 aft, 0, 1 fore).
// Every room is on the one plan, z 0.

export default {
  rooms: [
    { id: "wenna.concourse", name: "Concourse", x: 0, y: 0, z: 0, hour: 0, band: 0, terrain: "room", gravity: 0.6 },
    { id: "wenna.market", name: "Exchange", x: 0, y: 1, z: 0, hour: 0, band: 1, terrain: "room", gravity: 0.6 },
    { id: "wenna.freight", name: "Freight Office", x: 0, y: -1, z: 0, hour: 0, band: -1, terrain: "room", gravity: 0.6 },
    { id: "wenna.berth", name: "Berths", x: 1, y: 0, z: 0, hour: 1, band: 0, terrain: "room", gravity: 0.6 },
    { id: "wenna.charts", name: "Chart Office", x: -1, y: 0, z: 0, hour: 11, band: 0, terrain: "room", gravity: 0.6 },
    { id: "wenna.lounge", name: "Lounge", x: 0, y: 0, z: 0, hour: null, band: null, terrain: "lounge", gravity: 0.2 },
  ],
};

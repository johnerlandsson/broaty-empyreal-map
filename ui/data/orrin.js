// Orrin Station's six rooms, from content/areas/orrin.yaml in the Empyreal source. The area has
// no layout (no addresses or coords), so the places here are read off its exits and
// descriptions: one drum spun to half a g, the Concourse a hall round the inside of it, the
// Exchange north (fore) of it, the Freight Office south (aft), the Berths east (spinward), the
// Chart Office west, and the Gallery up a spiral stair at the axis.
//
// x runs west to east along the hall, y south to north; `hour` is the room's place round the
// drum for the model (12:00 is the Concourse), `band` its place along the axis (-1 aft, 0, 1 fore).
// Every room is on the one plan, z 0.

export default {
  rooms: [
    { id: "orrin.concourse", name: "Concourse", x: 0, y: 0, z: 0, hour: 0, band: 0, terrain: "room", gravity: 0.5 },
    { id: "orrin.market", name: "Exchange", x: 0, y: 1, z: 0, hour: 0, band: 1, terrain: "room", gravity: 0.5 },
    { id: "orrin.freight", name: "Freight Office", x: 0, y: -1, z: 0, hour: 0, band: -1, terrain: "room", gravity: 0.5 },
    { id: "orrin.berth", name: "Berths", x: 1, y: 0, z: 0, hour: 1, band: 0, terrain: "room", gravity: 0.5 },
    { id: "orrin.charts", name: "Chart Office", x: -1, y: 0, z: 0, hour: 11, band: 0, terrain: "room", gravity: 0.5 },
    { id: "orrin.gallery", name: "Gallery", x: 0, y: 0, z: 0, hour: null, band: null, terrain: "gallery", gravity: 0.1 },
  ],
};

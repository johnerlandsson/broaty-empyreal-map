// Garrow Stop's six rooms, from content/areas/garrow.yaml in the Empyreal source: the high port of
// Roughtor, a bare world at Garrow, deep in the Mid, kept by prospectors working Dozmary's belts. A
// weightless box on decks, smaller than Orrin's (see orrin.js) and laid out otherwise: two frames
// long and two decks deep, the Berths, Exchange and Snug on Deck 2, and on Deck 1 the Commons, and
// fore of it, under the Berths, the Lookout, a glass blister at the station's fore end. Each room's
// cell comes from its address (lib/decks.js). Exits are as the YAML stores them: north fore, south
// aft, west port, east starboard. Gravity is the area's, 0 g.

export default {
  rooms: [
    // Deck 2
    { id: "garrow.berth", name: "Berths", address: "Deck 2, frame 2", gravity: 0, flags: ["berth", "listed"], exits: { south: "garrow.deck-2-frame-1" } },
    {
      id: "garrow.deck-2-frame-1",
      name: "Deck 2, frame 1",
      address: "Deck 2, frame 1",
      gravity: 0,
      flags: [],
      exits: { north: "garrow.berth", west: "garrow.market", east: "garrow.snug", down: "garrow.commons" },
    },
    { id: "garrow.market", name: "Exchange", address: "Deck 2, frame 1, port 1", gravity: 0, flags: ["market", "freight", "listed"], exits: { east: "garrow.deck-2-frame-1" } },
    { id: "garrow.snug", name: "Snug", address: "Deck 2, frame 1, starboard 1", gravity: 0, flags: ["listed"], exits: { west: "garrow.deck-2-frame-1" } },
    // Deck 1
    { id: "garrow.commons", name: "Commons", address: "Deck 1, frame 1", gravity: 0, flags: ["listed"], exits: { north: "garrow.lookout", up: "garrow.deck-2-frame-1" } },
    { id: "garrow.lookout", name: "Lookout", address: "Deck 1, frame 2", gravity: 0, flags: ["listed"], exits: { south: "garrow.commons" } },
  ],
};

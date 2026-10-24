// Penwith Vats' nine rooms, from content/areas/penwith.yaml in the Empyreal source: the high port
// of Penwith, a world of domed towns at Euny. An outpost of Orrin Station's class, laid out as
// Orrin's is (see orrin.js): a weightless box on decks, three frames long and two decks deep, with
// the Gallery in a glass blister on Deck 1, under Deck 2. Each room's cell comes from its address
// (lib/decks.js). Exits are as the YAML stores them: north fore, south aft, west port, east
// starboard. Gravity is the area's, 0 g.

export default {
  rooms: [
    // Deck 3
    { id: "penwith.berth", name: "Berths", address: "Deck 3, frame 3", gravity: 0, flags: ["berth", "listed"], exits: { south: "penwith.deck-3-frame-2" } },
    {
      id: "penwith.deck-3-frame-2",
      name: "Deck 3, frame 2",
      address: "Deck 3, frame 2",
      gravity: 0,
      flags: [],
      exits: { north: "penwith.berth", south: "penwith.deck-3-frame-1", west: "penwith.freight", east: "penwith.charts" },
    },
    { id: "penwith.freight", name: "Freight Office", address: "Deck 3, frame 2, port 1", gravity: 0, flags: ["freight", "listed"], exits: { east: "penwith.deck-3-frame-2" } },
    { id: "penwith.charts", name: "Chart Office", address: "Deck 3, frame 2, starboard 1", gravity: 0, flags: ["charts", "listed"], exits: { west: "penwith.deck-3-frame-2" } },
    { id: "penwith.deck-3-frame-1", name: "Deck 3, frame 1", address: "Deck 3, frame 1", gravity: 0, flags: [], exits: { north: "penwith.deck-3-frame-2", down: "penwith.concourse" } },
    // Deck 2
    { id: "penwith.concourse", name: "Concourse", address: "Deck 2, frame 1", gravity: 0, flags: ["listed"], exits: { north: "penwith.deck-2-frame-2", up: "penwith.deck-3-frame-1" } },
    {
      id: "penwith.deck-2-frame-2",
      name: "Deck 2, frame 2",
      address: "Deck 2, frame 2",
      gravity: 0,
      flags: [],
      exits: { south: "penwith.concourse", west: "penwith.market", down: "penwith.gallery" },
    },
    { id: "penwith.market", name: "Exchange", address: "Deck 2, frame 2, port 1", gravity: 0, flags: ["market", "listed"], exits: { east: "penwith.deck-2-frame-2" } },
    // Deck 1
    { id: "penwith.gallery", name: "Gallery", address: "Deck 1, frame 2", gravity: 0, flags: ["listed"], exits: { up: "penwith.deck-2-frame-2" } },
  ],
};

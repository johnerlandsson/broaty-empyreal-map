// Lanyon High's nine rooms, from content/areas/lanyon.yaml in the Empyreal source: the high port
// of Lanyon, an old garden world at Mabyn. An outpost of Orrin Station's class, laid out as Orrin's
// is (see orrin.js): a weightless box on decks, three frames long and two decks deep, with the
// Gallery in a glass blister on Deck 1, under Deck 2. Each room's cell comes from its address
// (lib/decks.js). Exits are as the YAML stores them: north fore, south aft, west port, east
// starboard. Gravity is the area's, 0 g.

export default {
  rooms: [
    // Deck 3
    { id: "lanyon.berth", name: "Berths", address: "Deck 3, frame 3", gravity: 0, flags: ["berth", "listed"], exits: { south: "lanyon.deck-3-frame-2" } },
    {
      id: "lanyon.deck-3-frame-2",
      name: "Deck 3, frame 2",
      address: "Deck 3, frame 2",
      gravity: 0,
      flags: [],
      exits: { north: "lanyon.berth", south: "lanyon.deck-3-frame-1", west: "lanyon.freight", east: "lanyon.charts" },
    },
    { id: "lanyon.freight", name: "Freight Office", address: "Deck 3, frame 2, port 1", gravity: 0, flags: ["freight", "listed"], exits: { east: "lanyon.deck-3-frame-2" } },
    { id: "lanyon.charts", name: "Chart Office", address: "Deck 3, frame 2, starboard 1", gravity: 0, flags: ["charts", "listed"], exits: { west: "lanyon.deck-3-frame-2" } },
    { id: "lanyon.deck-3-frame-1", name: "Deck 3, frame 1", address: "Deck 3, frame 1", gravity: 0, flags: [], exits: { north: "lanyon.deck-3-frame-2", down: "lanyon.concourse" } },
    // Deck 2
    { id: "lanyon.concourse", name: "Concourse", address: "Deck 2, frame 1", gravity: 0, flags: ["listed"], exits: { north: "lanyon.deck-2-frame-2", up: "lanyon.deck-3-frame-1" } },
    {
      id: "lanyon.deck-2-frame-2",
      name: "Deck 2, frame 2",
      address: "Deck 2, frame 2",
      gravity: 0,
      flags: [],
      exits: { south: "lanyon.concourse", west: "lanyon.market", down: "lanyon.gallery" },
    },
    { id: "lanyon.market", name: "Exchange", address: "Deck 2, frame 2, port 1", gravity: 0, flags: ["market", "listed"], exits: { east: "lanyon.deck-2-frame-2" } },
    // Deck 1
    { id: "lanyon.gallery", name: "Gallery", address: "Deck 1, frame 2", gravity: 0, flags: ["listed"], exits: { up: "lanyon.deck-2-frame-2" } },
  ],
};

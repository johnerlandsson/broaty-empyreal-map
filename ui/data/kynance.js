// Kynance Spindle's nine rooms, from content/areas/kynance.yaml in the Empyreal source: the high
// port of Kynance, an ice world at Piran. An outpost of Orrin Station's class, laid out as Orrin's
// is (see orrin.js): a weightless box on decks, three frames long and two decks deep, with the
// Gallery in a glass blister on Deck 1, under Deck 2. Each room's cell comes from its address
// (lib/decks.js). Exits are as the YAML stores them: north fore, south aft, west port, east
// starboard. Gravity is the area's, 0 g.

export default {
  rooms: [
    // Deck 3
    { id: "kynance.berth", name: "Berths", address: "Deck 3, frame 3", gravity: 0, flags: ["berth", "listed"], exits: { south: "kynance.deck-3-frame-2" } },
    {
      id: "kynance.deck-3-frame-2",
      name: "Deck 3, frame 2",
      address: "Deck 3, frame 2",
      gravity: 0,
      flags: [],
      exits: { north: "kynance.berth", south: "kynance.deck-3-frame-1", west: "kynance.freight", east: "kynance.charts" },
    },
    { id: "kynance.freight", name: "Freight Office", address: "Deck 3, frame 2, port 1", gravity: 0, flags: ["freight", "listed"], exits: { east: "kynance.deck-3-frame-2" } },
    { id: "kynance.charts", name: "Chart Office", address: "Deck 3, frame 2, starboard 1", gravity: 0, flags: ["charts", "listed"], exits: { west: "kynance.deck-3-frame-2" } },
    { id: "kynance.deck-3-frame-1", name: "Deck 3, frame 1", address: "Deck 3, frame 1", gravity: 0, flags: [], exits: { north: "kynance.deck-3-frame-2", down: "kynance.concourse" } },
    // Deck 2
    { id: "kynance.concourse", name: "Concourse", address: "Deck 2, frame 1", gravity: 0, flags: ["listed"], exits: { north: "kynance.deck-2-frame-2", up: "kynance.deck-3-frame-1" } },
    {
      id: "kynance.deck-2-frame-2",
      name: "Deck 2, frame 2",
      address: "Deck 2, frame 2",
      gravity: 0,
      flags: [],
      exits: { south: "kynance.concourse", west: "kynance.market", down: "kynance.gallery" },
    },
    { id: "kynance.market", name: "Exchange", address: "Deck 2, frame 2, port 1", gravity: 0, flags: ["market", "listed"], exits: { east: "kynance.deck-2-frame-2" } },
    // Deck 1
    { id: "kynance.gallery", name: "Gallery", address: "Deck 1, frame 2", gravity: 0, flags: ["listed"], exits: { up: "kynance.deck-2-frame-2" } },
  ],
};

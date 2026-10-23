// Carrow Yard's nine rooms, from content/areas/carrow.yaml in the Empyreal source: the high port
// of Carrow, the shipyard world at Elowen. An outpost of Orrin Station's class, laid out as Orrin's
// is (see orrin.js): a weightless box on decks, three frames long and two decks deep, with the
// Gallery in a glass blister on Deck 1, under Deck 2. Each room's cell comes from its address
// (lib/decks.js). Exits are as the YAML stores them: north fore, south aft, west port, east
// starboard. Gravity is the area's, 0 g.

export default {
  rooms: [
    // Deck 3
    { id: "carrow.berth", name: "Berths", address: "Deck 3, frame 3", gravity: 0, flags: ["berth", "listed"], exits: { south: "carrow.deck-3-frame-2" } },
    {
      id: "carrow.deck-3-frame-2",
      name: "Deck 3, frame 2",
      address: "Deck 3, frame 2",
      gravity: 0,
      flags: [],
      exits: { north: "carrow.berth", south: "carrow.deck-3-frame-1", west: "carrow.freight", east: "carrow.charts" },
    },
    { id: "carrow.freight", name: "Freight Office", address: "Deck 3, frame 2, port 1", gravity: 0, flags: ["freight", "listed"], exits: { east: "carrow.deck-3-frame-2" } },
    { id: "carrow.charts", name: "Chart Office", address: "Deck 3, frame 2, starboard 1", gravity: 0, flags: ["charts", "listed"], exits: { west: "carrow.deck-3-frame-2" } },
    { id: "carrow.deck-3-frame-1", name: "Deck 3, frame 1", address: "Deck 3, frame 1", gravity: 0, flags: [], exits: { north: "carrow.deck-3-frame-2", down: "carrow.concourse" } },
    // Deck 2
    { id: "carrow.concourse", name: "Concourse", address: "Deck 2, frame 1", gravity: 0, flags: ["listed"], exits: { north: "carrow.deck-2-frame-2", up: "carrow.deck-3-frame-1" } },
    {
      id: "carrow.deck-2-frame-2",
      name: "Deck 2, frame 2",
      address: "Deck 2, frame 2",
      gravity: 0,
      flags: [],
      exits: { south: "carrow.concourse", west: "carrow.market", down: "carrow.gallery" },
    },
    { id: "carrow.market", name: "Exchange", address: "Deck 2, frame 2, port 1", gravity: 0, flags: ["market", "listed"], exits: { east: "carrow.deck-2-frame-2" } },
    // Deck 1
    { id: "carrow.gallery", name: "Gallery", address: "Deck 1, frame 2", gravity: 0, flags: ["listed"], exits: { up: "carrow.deck-2-frame-2" } },
  ],
};

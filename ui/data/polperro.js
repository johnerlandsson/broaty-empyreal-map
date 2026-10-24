// Polperro Old Dock's nine rooms, from content/areas/polperro.yaml in the Empyreal source: the high
// port of Polperro, a half-emptied old colony at Germoe. An outpost of Orrin Station's class, laid
// out as Orrin's is (see orrin.js): a weightless box on decks, three frames long and two decks
// deep, with the Gallery in a glass blister on Deck 1, under Deck 2. Each room's cell comes from
// its address (lib/decks.js). Exits are as the YAML stores them: north fore, south aft, west port,
// east starboard. Gravity is the area's, 0 g.

export default {
  rooms: [
    // Deck 3
    { id: "polperro.berth", name: "Berths", address: "Deck 3, frame 3", gravity: 0, flags: ["berth", "listed"], exits: { south: "polperro.deck-3-frame-2" } },
    {
      id: "polperro.deck-3-frame-2",
      name: "Deck 3, frame 2",
      address: "Deck 3, frame 2",
      gravity: 0,
      flags: [],
      exits: { north: "polperro.berth", south: "polperro.deck-3-frame-1", west: "polperro.freight", east: "polperro.charts" },
    },
    { id: "polperro.freight", name: "Freight Office", address: "Deck 3, frame 2, port 1", gravity: 0, flags: ["freight", "listed"], exits: { east: "polperro.deck-3-frame-2" } },
    { id: "polperro.charts", name: "Chart Office", address: "Deck 3, frame 2, starboard 1", gravity: 0, flags: ["charts", "listed"], exits: { west: "polperro.deck-3-frame-2" } },
    { id: "polperro.deck-3-frame-1", name: "Deck 3, frame 1", address: "Deck 3, frame 1", gravity: 0, flags: [], exits: { north: "polperro.deck-3-frame-2", down: "polperro.concourse" } },
    // Deck 2
    { id: "polperro.concourse", name: "Concourse", address: "Deck 2, frame 1", gravity: 0, flags: ["listed"], exits: { north: "polperro.deck-2-frame-2", up: "polperro.deck-3-frame-1" } },
    {
      id: "polperro.deck-2-frame-2",
      name: "Deck 2, frame 2",
      address: "Deck 2, frame 2",
      gravity: 0,
      flags: [],
      exits: { south: "polperro.concourse", west: "polperro.market", down: "polperro.gallery" },
    },
    { id: "polperro.market", name: "Exchange", address: "Deck 2, frame 2, port 1", gravity: 0, flags: ["market", "listed"], exits: { east: "polperro.deck-2-frame-2" } },
    // Deck 1
    { id: "polperro.gallery", name: "Gallery", address: "Deck 1, frame 2", gravity: 0, flags: ["listed"], exits: { up: "polperro.deck-2-frame-2" } },
  ],
};

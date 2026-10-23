// Morvah Deep's nine rooms, from content/areas/morvah.yaml in the Empyreal source: the skimmer port
// of Morvah, a gas giant at Petroc. An outpost of Orrin Station's class, laid out as Orrin's is (see
// orrin.js): a weightless box on decks, three frames long and two decks deep, with the Gallery in a
// glass blister on Deck 1, under Deck 2. Each room's cell comes from its address (lib/decks.js).
// Exits are as the YAML stores them: north fore, south aft, west port, east starboard. Gravity is
// the area's, 0 g.

export default {
  rooms: [
    // Deck 3
    { id: "morvah.berth", name: "Berths", address: "Deck 3, frame 3", gravity: 0, flags: ["berth", "listed"], exits: { south: "morvah.deck-3-frame-2" } },
    {
      id: "morvah.deck-3-frame-2",
      name: "Deck 3, frame 2",
      address: "Deck 3, frame 2",
      gravity: 0,
      flags: [],
      exits: { north: "morvah.berth", south: "morvah.deck-3-frame-1", west: "morvah.freight", east: "morvah.charts" },
    },
    { id: "morvah.freight", name: "Freight Office", address: "Deck 3, frame 2, port 1", gravity: 0, flags: ["freight", "listed"], exits: { east: "morvah.deck-3-frame-2" } },
    { id: "morvah.charts", name: "Chart Office", address: "Deck 3, frame 2, starboard 1", gravity: 0, flags: ["charts", "listed"], exits: { west: "morvah.deck-3-frame-2" } },
    { id: "morvah.deck-3-frame-1", name: "Deck 3, frame 1", address: "Deck 3, frame 1", gravity: 0, flags: [], exits: { north: "morvah.deck-3-frame-2", down: "morvah.concourse" } },
    // Deck 2
    { id: "morvah.concourse", name: "Concourse", address: "Deck 2, frame 1", gravity: 0, flags: ["listed"], exits: { north: "morvah.deck-2-frame-2", up: "morvah.deck-3-frame-1" } },
    {
      id: "morvah.deck-2-frame-2",
      name: "Deck 2, frame 2",
      address: "Deck 2, frame 2",
      gravity: 0,
      flags: [],
      exits: { south: "morvah.concourse", west: "morvah.market", down: "morvah.gallery" },
    },
    { id: "morvah.market", name: "Exchange", address: "Deck 2, frame 2, port 1", gravity: 0, flags: ["market", "listed"], exits: { east: "morvah.deck-2-frame-2" } },
    // Deck 1
    { id: "morvah.gallery", name: "Gallery", address: "Deck 1, frame 2", gravity: 0, flags: ["listed"], exits: { up: "morvah.deck-2-frame-2" } },
  ],
};

// Lamorna Light's nine rooms, from content/areas/lamorna.yaml in the Empyreal source: the high port
// of Lamorna, a cold, dim world at Feock, and a stores depot for ships bound inward. An outpost of
// Orrin Station's class, laid out as Orrin's is (see orrin.js): a weightless box on decks, three
// frames long and two decks deep, with the Gallery in a glass blister on Deck 1, under Deck 2. Each
// room's cell comes from its address (lib/decks.js). Exits are as the YAML stores them: north fore,
// south aft, west port, east starboard. Gravity is the area's, 0 g.

export default {
  rooms: [
    // Deck 3
    { id: "lamorna.berth", name: "Berths", address: "Deck 3, frame 3", gravity: 0, flags: ["berth", "listed"], exits: { south: "lamorna.deck-3-frame-2" } },
    {
      id: "lamorna.deck-3-frame-2",
      name: "Deck 3, frame 2",
      address: "Deck 3, frame 2",
      gravity: 0,
      flags: [],
      exits: { north: "lamorna.berth", south: "lamorna.deck-3-frame-1", west: "lamorna.freight", east: "lamorna.charts" },
    },
    { id: "lamorna.freight", name: "Freight Office", address: "Deck 3, frame 2, port 1", gravity: 0, flags: ["freight", "listed"], exits: { east: "lamorna.deck-3-frame-2" } },
    { id: "lamorna.charts", name: "Chart Office", address: "Deck 3, frame 2, starboard 1", gravity: 0, flags: ["charts", "listed"], exits: { west: "lamorna.deck-3-frame-2" } },
    { id: "lamorna.deck-3-frame-1", name: "Deck 3, frame 1", address: "Deck 3, frame 1", gravity: 0, flags: [], exits: { north: "lamorna.deck-3-frame-2", down: "lamorna.concourse" } },
    // Deck 2
    { id: "lamorna.concourse", name: "Concourse", address: "Deck 2, frame 1", gravity: 0, flags: ["listed"], exits: { north: "lamorna.deck-2-frame-2", up: "lamorna.deck-3-frame-1" } },
    {
      id: "lamorna.deck-2-frame-2",
      name: "Deck 2, frame 2",
      address: "Deck 2, frame 2",
      gravity: 0,
      flags: [],
      exits: { south: "lamorna.concourse", west: "lamorna.market", down: "lamorna.gallery" },
    },
    { id: "lamorna.market", name: "Exchange", address: "Deck 2, frame 2, port 1", gravity: 0, flags: ["market", "listed"], exits: { east: "lamorna.deck-2-frame-2" } },
    // Deck 1
    { id: "lamorna.gallery", name: "Gallery", address: "Deck 1, frame 2", gravity: 0, flags: ["listed"], exits: { up: "lamorna.deck-2-frame-2" } },
  ],
};

// Marazion Quay's nine rooms, from content/areas/marazion.yaml in the Empyreal source: the high
// port of Marazion, a warm, wet world of spice terraces at Breage. An outpost of Orrin Station's
// class, laid out as Orrin's is (see orrin.js): a weightless box on decks, three frames long and
// two decks deep, with the Gallery in a glass blister on Deck 1, under Deck 2. Each room's cell
// comes from its address (lib/decks.js). Exits are as the YAML stores them: north fore, south aft,
// west port, east starboard. Gravity is the area's, 0 g.

export default {
  rooms: [
    // Deck 3
    { id: "marazion.berth", name: "Berths", address: "Deck 3, frame 3", gravity: 0, flags: ["berth", "listed"], exits: { south: "marazion.deck-3-frame-2" } },
    {
      id: "marazion.deck-3-frame-2",
      name: "Deck 3, frame 2",
      address: "Deck 3, frame 2",
      gravity: 0,
      flags: [],
      exits: { north: "marazion.berth", south: "marazion.deck-3-frame-1", west: "marazion.freight", east: "marazion.charts" },
    },
    { id: "marazion.freight", name: "Freight Office", address: "Deck 3, frame 2, port 1", gravity: 0, flags: ["freight", "listed"], exits: { east: "marazion.deck-3-frame-2" } },
    { id: "marazion.charts", name: "Chart Office", address: "Deck 3, frame 2, starboard 1", gravity: 0, flags: ["charts", "listed"], exits: { west: "marazion.deck-3-frame-2" } },
    { id: "marazion.deck-3-frame-1", name: "Deck 3, frame 1", address: "Deck 3, frame 1", gravity: 0, flags: [], exits: { north: "marazion.deck-3-frame-2", down: "marazion.concourse" } },
    // Deck 2
    { id: "marazion.concourse", name: "Concourse", address: "Deck 2, frame 1", gravity: 0, flags: ["listed"], exits: { north: "marazion.deck-2-frame-2", up: "marazion.deck-3-frame-1" } },
    {
      id: "marazion.deck-2-frame-2",
      name: "Deck 2, frame 2",
      address: "Deck 2, frame 2",
      gravity: 0,
      flags: [],
      exits: { south: "marazion.concourse", west: "marazion.market", down: "marazion.gallery" },
    },
    { id: "marazion.market", name: "Exchange", address: "Deck 2, frame 2, port 1", gravity: 0, flags: ["market", "listed"], exits: { east: "marazion.deck-2-frame-2" } },
    // Deck 1
    { id: "marazion.gallery", name: "Gallery", address: "Deck 1, frame 2", gravity: 0, flags: ["listed"], exits: { up: "marazion.deck-2-frame-2" } },
  ],
};

// Caradon Works' six rooms, from content/areas/caradon.yaml in the Empyreal source: the high port
// of Pensilva, a mined world at Caradon, out in the Mid, owned with its pits by a mining company. A
// weightless box on decks, smaller than Orrin's (see orrin.js) and laid out otherwise: two frames
// long and two decks deep, the Berths, Exchange and Canteen on Deck 3, the Shift Hall alone on
// Deck 2 under the passage, and the Gallery in a glass blister on Deck 1, under the Shift Hall. Each
// room's cell comes from its address (lib/decks.js). Exits are as the YAML stores them: north fore,
// south aft, west port, east starboard. Gravity is the area's, 0 g.

export default {
  rooms: [
    // Deck 3
    { id: "caradon.berth", name: "Berths", address: "Deck 3, frame 2", gravity: 0, flags: ["berth", "listed"], exits: { south: "caradon.deck-3-frame-1" } },
    {
      id: "caradon.deck-3-frame-1",
      name: "Deck 3, frame 1",
      address: "Deck 3, frame 1",
      gravity: 0,
      flags: [],
      exits: { north: "caradon.berth", west: "caradon.market", east: "caradon.canteen", down: "caradon.hall" },
    },
    { id: "caradon.market", name: "Exchange", address: "Deck 3, frame 1, port 1", gravity: 0, flags: ["market", "freight", "listed"], exits: { east: "caradon.deck-3-frame-1" } },
    { id: "caradon.canteen", name: "Canteen", address: "Deck 3, frame 1, starboard 1", gravity: 0, flags: ["listed"], exits: { west: "caradon.deck-3-frame-1" } },
    // Deck 2
    { id: "caradon.hall", name: "Shift Hall", address: "Deck 2, frame 1", gravity: 0, flags: ["listed"], exits: { up: "caradon.deck-3-frame-1", down: "caradon.gallery" } },
    // Deck 1
    { id: "caradon.gallery", name: "Gallery", address: "Deck 1, frame 1", gravity: 0, flags: ["listed"], exits: { up: "caradon.hall" } },
  ],
};

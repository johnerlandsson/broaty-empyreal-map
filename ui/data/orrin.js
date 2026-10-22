// Orrin Station's nine rooms, from content/areas/orrin.yaml in the Empyreal source: a weightless
// box laid out on decks (`layout: kind: decks`, station.md §2.6), three frames long and two decks
// deep, with the Gallery in a glass blister on Deck 1, under Deck 2. Nothing here is placed by
// hand: each room's cell comes from its address (lib/decks.js), as the game's coords do (x the
// side, starboard positive; y the frame, counting fore; z the deck). Exits are as the YAML stores
// them: north fore, south aft, west port, east starboard. Gravity is the area's, 0 g.

export default {
  rooms: [
    // Deck 3
    { id: "orrin.berth", name: "Berths", address: "Deck 3, frame 3", gravity: 0, flags: ["berth", "listed"], exits: { south: "orrin.deck-3-frame-2" } },
    {
      id: "orrin.deck-3-frame-2",
      name: "Deck 3, frame 2",
      address: "Deck 3, frame 2",
      gravity: 0,
      flags: [],
      exits: { north: "orrin.berth", south: "orrin.deck-3-frame-1", west: "orrin.freight", east: "orrin.charts" },
    },
    { id: "orrin.freight", name: "Freight Office", address: "Deck 3, frame 2, port 1", gravity: 0, flags: ["freight", "listed"], exits: { east: "orrin.deck-3-frame-2" } },
    { id: "orrin.charts", name: "Chart Office", address: "Deck 3, frame 2, starboard 1", gravity: 0, flags: ["charts", "listed"], exits: { west: "orrin.deck-3-frame-2" } },
    { id: "orrin.deck-3-frame-1", name: "Deck 3, frame 1", address: "Deck 3, frame 1", gravity: 0, flags: [], exits: { north: "orrin.deck-3-frame-2", down: "orrin.concourse" } },
    // Deck 2
    { id: "orrin.concourse", name: "Concourse", address: "Deck 2, frame 1", gravity: 0, flags: ["listed"], exits: { north: "orrin.deck-2-frame-2", up: "orrin.deck-3-frame-1" } },
    {
      id: "orrin.deck-2-frame-2",
      name: "Deck 2, frame 2",
      address: "Deck 2, frame 2",
      gravity: 0,
      flags: [],
      exits: { south: "orrin.concourse", west: "orrin.market", down: "orrin.gallery" },
    },
    { id: "orrin.market", name: "Exchange", address: "Deck 2, frame 2, port 1", gravity: 0, flags: ["market", "listed"], exits: { east: "orrin.deck-2-frame-2" } },
    // Deck 1
    { id: "orrin.gallery", name: "Gallery", address: "Deck 1, frame 2", gravity: 0, flags: ["listed"], exits: { up: "orrin.deck-2-frame-2" } },
  ],
};

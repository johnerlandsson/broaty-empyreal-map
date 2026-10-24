// Kilmar Steading's six rooms, from content/areas/kilmar.yaml in the Empyreal source: the high port
// of Henwood, a wet green moorland world at Kilmar, out in the Mid, built and run by its settlers as
// a cooperative. A weightless box on decks, smaller than Orrin's (see orrin.js) and laid out
// otherwise: Deck 2 a cross of five cells, the Berths at the nose, the Exchange and Kitchen either
// side of the passage and the Commons aft, and the Gallery in a glass blister on Deck 1, under the
// Commons. Each room's cell comes from its address (lib/decks.js). Exits are as the YAML stores
// them: north fore, south aft, west port, east starboard. Gravity is the area's, 0 g.

export default {
  rooms: [
    // Deck 2
    { id: "kilmar.berth", name: "Berths", address: "Deck 2, frame 3", gravity: 0, flags: ["berth", "listed"], exits: { south: "kilmar.deck-2-frame-2" } },
    {
      id: "kilmar.deck-2-frame-2",
      name: "Deck 2, frame 2",
      address: "Deck 2, frame 2",
      gravity: 0,
      flags: [],
      exits: { north: "kilmar.berth", south: "kilmar.commons", west: "kilmar.market", east: "kilmar.kitchen" },
    },
    { id: "kilmar.market", name: "Exchange", address: "Deck 2, frame 2, port 1", gravity: 0, flags: ["market", "freight", "listed"], exits: { east: "kilmar.deck-2-frame-2" } },
    { id: "kilmar.kitchen", name: "Kitchen", address: "Deck 2, frame 2, starboard 1", gravity: 0, flags: ["listed"], exits: { west: "kilmar.deck-2-frame-2" } },
    { id: "kilmar.commons", name: "Commons", address: "Deck 2, frame 1", gravity: 0, flags: ["listed"], exits: { north: "kilmar.deck-2-frame-2", down: "kilmar.gallery" } },
    // Deck 1
    { id: "kilmar.gallery", name: "Gallery", address: "Deck 1, frame 1", gravity: 0, flags: ["listed"], exits: { up: "kilmar.commons" } },
  ],
};

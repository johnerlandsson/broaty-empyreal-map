// Botallack Head's nine rooms, from content/areas/botallack.yaml in the Empyreal source: the high
// port of Botallack, a mined-out, ringed world at Madron. An outpost of Orrin Station's class, laid
// out as Orrin's is (see orrin.js): a weightless box on decks, three frames long and two decks
// deep, with the Gallery in a glass blister on Deck 1, under Deck 2. Each room's cell comes from
// its address (lib/decks.js). Exits are as the YAML stores them: north fore, south aft, west port,
// east starboard. Gravity is the area's, 0 g.

export default {
  rooms: [
    // Deck 3
    { id: "botallack.berth", name: "Berths", address: "Deck 3, frame 3", gravity: 0, flags: ["berth", "listed"], exits: { south: "botallack.deck-3-frame-2" } },
    {
      id: "botallack.deck-3-frame-2",
      name: "Deck 3, frame 2",
      address: "Deck 3, frame 2",
      gravity: 0,
      flags: [],
      exits: { north: "botallack.berth", south: "botallack.deck-3-frame-1", west: "botallack.freight", east: "botallack.charts" },
    },
    { id: "botallack.freight", name: "Freight Office", address: "Deck 3, frame 2, port 1", gravity: 0, flags: ["freight", "listed"], exits: { east: "botallack.deck-3-frame-2" } },
    { id: "botallack.charts", name: "Chart Office", address: "Deck 3, frame 2, starboard 1", gravity: 0, flags: ["charts", "listed"], exits: { west: "botallack.deck-3-frame-2" } },
    { id: "botallack.deck-3-frame-1", name: "Deck 3, frame 1", address: "Deck 3, frame 1", gravity: 0, flags: [], exits: { north: "botallack.deck-3-frame-2", down: "botallack.concourse" } },
    // Deck 2
    { id: "botallack.concourse", name: "Concourse", address: "Deck 2, frame 1", gravity: 0, flags: ["listed"], exits: { north: "botallack.deck-2-frame-2", up: "botallack.deck-3-frame-1" } },
    {
      id: "botallack.deck-2-frame-2",
      name: "Deck 2, frame 2",
      address: "Deck 2, frame 2",
      gravity: 0,
      flags: [],
      exits: { south: "botallack.concourse", west: "botallack.market", down: "botallack.gallery" },
    },
    { id: "botallack.market", name: "Exchange", address: "Deck 2, frame 2, port 1", gravity: 0, flags: ["market", "listed"], exits: { east: "botallack.deck-2-frame-2" } },
    // Deck 1
    { id: "botallack.gallery", name: "Gallery", address: "Deck 1, frame 2", gravity: 0, flags: ["listed"], exits: { up: "botallack.deck-2-frame-2" } },
  ],
};

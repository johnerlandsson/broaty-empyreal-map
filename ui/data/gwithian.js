// Gwithian Reach's nine rooms, from content/areas/gwithian.yaml in the Empyreal source: the high
// port of Gwithian, a dry smelting world at Keyne. An outpost of Orrin Station's class, laid out as
// Orrin's is (see orrin.js): a weightless box on decks, three frames long and two decks deep, with
// the Gallery in a glass blister on Deck 1, under Deck 2. Each room's cell comes from its address
// (lib/decks.js). Exits are as the YAML stores them: north fore, south aft, west port, east
// starboard. Gravity is the area's, 0 g.

export default {
  rooms: [
    // Deck 3
    { id: "gwithian.berth", name: "Berths", address: "Deck 3, frame 3", gravity: 0, flags: ["berth", "listed"], exits: { south: "gwithian.deck-3-frame-2" } },
    {
      id: "gwithian.deck-3-frame-2",
      name: "Deck 3, frame 2",
      address: "Deck 3, frame 2",
      gravity: 0,
      flags: [],
      exits: { north: "gwithian.berth", south: "gwithian.deck-3-frame-1", west: "gwithian.freight", east: "gwithian.charts" },
    },
    { id: "gwithian.freight", name: "Freight Office", address: "Deck 3, frame 2, port 1", gravity: 0, flags: ["freight", "listed"], exits: { east: "gwithian.deck-3-frame-2" } },
    { id: "gwithian.charts", name: "Chart Office", address: "Deck 3, frame 2, starboard 1", gravity: 0, flags: ["charts", "listed"], exits: { west: "gwithian.deck-3-frame-2" } },
    { id: "gwithian.deck-3-frame-1", name: "Deck 3, frame 1", address: "Deck 3, frame 1", gravity: 0, flags: [], exits: { north: "gwithian.deck-3-frame-2", down: "gwithian.concourse" } },
    // Deck 2
    { id: "gwithian.concourse", name: "Concourse", address: "Deck 2, frame 1", gravity: 0, flags: ["listed"], exits: { north: "gwithian.deck-2-frame-2", up: "gwithian.deck-3-frame-1" } },
    {
      id: "gwithian.deck-2-frame-2",
      name: "Deck 2, frame 2",
      address: "Deck 2, frame 2",
      gravity: 0,
      flags: [],
      exits: { south: "gwithian.concourse", west: "gwithian.market", down: "gwithian.gallery" },
    },
    { id: "gwithian.market", name: "Exchange", address: "Deck 2, frame 2, port 1", gravity: 0, flags: ["market", "listed"], exits: { east: "gwithian.deck-2-frame-2" } },
    // Deck 1
    { id: "gwithian.gallery", name: "Gallery", address: "Deck 1, frame 2", gravity: 0, flags: ["listed"], exits: { up: "gwithian.deck-2-frame-2" } },
  ],
};

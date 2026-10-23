// Zennor's fourteen rooms, from content/areas/zennor.yaml in the Empyreal source: a town on the
// planet Tamsin at 1 g, the first place in the game on the ground (docs/planetside.md). The area
// has no layout (`layout: none`): no addresses or coords, so the plan places each room by its
// compass exits (lib/town.js), and on a planet the compass means the compass. The landing field
// is at the north end, Fore Street runs south from its gate through the square to the terraces,
// and the Ridge Path climbs east and `up` to the Overlook. Exits and flags are as the YAML has
// them; `outdoors` is a room open to the sky.

export default {
  area: { id: "zennor", name: "Zennor", gravity: 1 },
  rooms: [
    // the field
    { id: "zennor.field", name: "Landing Field", flags: ["berth", "listed", "outdoors"], exits: { west: "zennor.field-office", east: "zennor.tower", south: "zennor.gate" } },
    { id: "zennor.field-office", name: "Field Office", flags: ["freight", "listed"], exits: { east: "zennor.field" } },
    { id: "zennor.tower", name: "Port Office", flags: ["charts", "listed"], exits: { west: "zennor.field" } },
    // the town
    { id: "zennor.gate", name: "Field Gate", flags: ["outdoors"], exits: { north: "zennor.field", south: "zennor.fore-top" } },
    { id: "zennor.fore-top", name: "Top of Fore Street", flags: ["outdoors"], exits: { north: "zennor.gate", south: "zennor.square", east: "zennor.ridge-path" } },
    { id: "zennor.ridge-path", name: "Ridge Path", flags: ["outdoors"], exits: { west: "zennor.fore-top", up: "zennor.overlook" } },
    { id: "zennor.overlook", name: "The Overlook", flags: ["listed", "outdoors"], exits: { down: "zennor.ridge-path" } },
    {
      id: "zennor.square",
      name: "The Square",
      flags: ["listed", "outdoors"],
      exits: { north: "zennor.fore-top", south: "zennor.fore-foot", west: "zennor.exchange", east: "zennor.inn" },
    },
    { id: "zennor.exchange", name: "Exchange", flags: ["market", "listed"], exits: { east: "zennor.square" } },
    { id: "zennor.inn", name: "The Tinner's Arms", flags: ["listed"], exits: { west: "zennor.square" } },
    { id: "zennor.fore-foot", name: "Foot of Fore Street", flags: ["outdoors"], exits: { north: "zennor.square", west: "zennor.water-house", south: "zennor.terraces" } },
    { id: "zennor.water-house", name: "Water House", flags: ["listed"], exits: { east: "zennor.fore-foot" } },
    { id: "zennor.terraces", name: "The Terraces", flags: ["listed", "outdoors"], exits: { north: "zennor.fore-foot", south: "zennor.lower-terraces" } },
    { id: "zennor.lower-terraces", name: "Lower Terraces", flags: ["outdoors"], exits: { north: "zennor.terraces" } },
  ],
};

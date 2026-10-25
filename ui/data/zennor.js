// Zennor's rooms, from content/areas/zennor.yaml in the Empyreal source: the capital of the planet
// Tamsin at 1 g, the first place in the game on the ground (docs/planetside.md §5). It's a city
// climbing the east side of the Carn's valley, so on foot east is uphill and west is down to the
// river. The area has no layout: no addresses or coords, so the plan places each room by its
// compass exits (lib/town.js), and on a planet the compass means the compass. Exits, flags and
// districts are as the YAML has them; `outdoors` is a room open to the sky, and an exit
// `via: steps` is a climb with its seconds each way. The tram's car is a room that moves, so it
// isn't one of the rooms here: `cars` has it with its stops, bottom to top.

export default {
  area: {
    id: "zennor",
    name: "Zennor",
    gravity: 1,
    districts: [
      { id: "downs", name: "the Downs", entrance: "zennor.field" },
      { id: "old-town", name: "the Old Town", entrance: "zennor.square" },
      { id: "market-quarter", name: "the Market Quarter", entrance: "zennor.exchange-square" },
      { id: "courts", name: "the Courts", entrance: "zennor.court-street" },
      { id: "rows", name: "the Rows", entrance: "zennor.slate-rows" },
      { id: "riverside", name: "Riverside", entrance: "zennor.embankment" },
      { id: "terraces", name: "the Terraces", entrance: "zennor.terraces" },
    ],
  },
  rooms: [
    // the Downs
    { id: "zennor.field", name: "Landing Field", district: "downs", flags: ["berth", "listed", "outdoors"], exits: { west: "zennor.field-office", east: "zennor.tower", south: "zennor.port-road" } },
    { id: "zennor.field-office", name: "Field Office", district: "downs", flags: ["freight", "listed", "charger"], exits: { east: "zennor.field" } },
    { id: "zennor.tower", name: "Port Office", district: "downs", flags: ["charts", "listed"], exits: { west: "zennor.field" } },
    { id: "zennor.port-road", name: "Port Road", district: "downs", flags: ["outdoors"], exits: { north: "zennor.field", south: "zennor.tram-downs", west: "zennor.steps-head" } },
    { id: "zennor.tram-downs", name: "Downs Station", district: "downs", flags: ["listed"], exits: { north: "zennor.port-road" } },
    { id: "zennor.steps-head", name: "Head of the Steps", district: "downs", flags: ["outdoors"], exits: { east: "zennor.port-road", down: { to: "zennor.gate", via: "steps", seconds: 12 } } },
    // the Old Town
    { id: "zennor.gate", name: "Field Gate", district: "old-town", flags: ["outdoors"], exits: { up: { to: "zennor.steps-head", via: "steps", seconds: 40 }, west: "zennor.fore-top" } },
    { id: "zennor.fore-top", name: "Top of Fore Street", district: "old-town", flags: ["outdoors"], exits: { east: "zennor.gate", west: "zennor.square", north: "zennor.ridge-path", south: "zennor.barber" } },
    { id: "zennor.barber", name: "Pellow's", district: "old-town", flags: ["barber", "listed"], exits: { north: "zennor.fore-top" } },
    { id: "zennor.ridge-path", name: "Ridge Path", district: "old-town", flags: ["outdoors"], exits: { south: "zennor.fore-top", up: "zennor.overlook" } },
    { id: "zennor.overlook", name: "The Overlook", district: "old-town", flags: ["listed", "outdoors"], exits: { down: "zennor.ridge-path" } },
    { id: "zennor.square", name: "The Square", district: "old-town", flags: ["listed", "outdoors"], exits: { east: "zennor.fore-top", west: "zennor.fore-foot", north: "zennor.inn", south: "zennor.tram-uptown", northwest: "zennor.tinners-hall" } },
    { id: "zennor.inn", name: "The Tinner's Arms", district: "old-town", flags: ["listed"], exits: { south: "zennor.square" } },
    { id: "zennor.tinners-hall", name: "Tinners' Hall", district: "old-town", flags: ["listed"], exits: { southeast: "zennor.square" } },
    { id: "zennor.tram-uptown", name: "Uptown Station", district: "old-town", flags: ["listed"], exits: { north: "zennor.square" } },
    { id: "zennor.fore-foot", name: "Foot of Fore Street", district: "old-town", flags: ["outdoors"], exits: { east: "zennor.square", west: "zennor.market-hill" } },
    // the Market Quarter
    { id: "zennor.market-hill", name: "Market Hill", district: "market-quarter", flags: ["outdoors"], exits: { east: "zennor.fore-foot", west: "zennor.exchange-square" } },
    { id: "zennor.exchange-square", name: "Conduit Square", district: "market-quarter", flags: ["listed", "outdoors"], exits: { north: "zennor.exchange", south: "zennor.covered-market", east: "zennor.market-hill", west: "zennor.court-street", southwest: "zennor.tram-market" } },
    { id: "zennor.exchange", name: "Corn Exchange", district: "market-quarter", flags: ["market", "listed"], exits: { south: "zennor.exchange-square" } },
    { id: "zennor.covered-market", name: "Pannier Market", district: "market-quarter", flags: ["listed"], exits: { north: "zennor.exchange-square", west: "zennor.chandlers", south: "zennor.slate-rows" } },
    { id: "zennor.chandlers", name: "Chandlers' Row", district: "market-quarter", flags: ["outdoors"], exits: { east: "zennor.covered-market", south: "zennor.salt-pan" } },
    { id: "zennor.salt-pan", name: "The Salt Pan", district: "market-quarter", flags: ["listed"], exits: { north: "zennor.chandlers" } },
    { id: "zennor.tram-market", name: "Market Station", district: "market-quarter", flags: ["listed"], exits: { northeast: "zennor.exchange-square" } },
    // the Courts
    { id: "zennor.court-street", name: "Court Street", district: "courts", flags: ["outdoors"], exits: { east: "zennor.exchange-square", north: "zennor.water-court", south: "zennor.rolls-office", west: "zennor.garden" } },
    { id: "zennor.water-court", name: "The Water Court", district: "courts", flags: ["listed"], exits: { south: "zennor.court-street" } },
    { id: "zennor.rolls-office", name: "Rolls Office", district: "courts", flags: ["listed"], exits: { north: "zennor.court-street" } },
    { id: "zennor.garden", name: "Founders' Garden", district: "courts", flags: ["listed", "outdoors"], exits: { east: "zennor.court-street", west: "zennor.moot-hall", north: "zennor.authority-house" } },
    { id: "zennor.moot-hall", name: "Moot Hall", district: "courts", flags: ["listed"], exits: { east: "zennor.garden" } },
    { id: "zennor.authority-house", name: "Authority House", district: "courts", flags: ["listed"], exits: { south: "zennor.garden" } },
    // the Rows
    { id: "zennor.slate-rows", name: "Slate Rows", district: "rows", flags: ["outdoors"], exits: { north: "zennor.covered-market", south: "zennor.tenement-court", west: "zennor.cistern-lane" } },
    { id: "zennor.tenement-court", name: "Cistern Court", district: "rows", flags: ["outdoors"], exits: { north: "zennor.slate-rows", east: "zennor.schoolhouse" } },
    { id: "zennor.schoolhouse", name: "Schoolhouse", district: "rows", flags: ["listed"], exits: { west: "zennor.tenement-court" } },
    { id: "zennor.cistern-lane", name: "Cistern Lane", district: "rows", flags: ["outdoors"], exits: { east: "zennor.slate-rows", south: "zennor.sweat", west: "zennor.embankment" } },
    { id: "zennor.sweat", name: "The Sweat", district: "rows", flags: ["listed"], exits: { north: "zennor.cistern-lane" } },
    // Riverside
    { id: "zennor.embankment", name: "The Embankment", district: "riverside", flags: ["listed", "outdoors"], exits: { north: "zennor.mill-lane", south: "zennor.leat-walk", east: "zennor.cistern-lane", northeast: "zennor.tram-riverside" } },
    { id: "zennor.mill-lane", name: "Mill Lane", district: "riverside", flags: ["outdoors"], exits: { south: "zennor.embankment", west: "zennor.carn-bridge", north: "zennor.kiln-yard" } },
    { id: "zennor.kiln-yard", name: "Kiln Yard", district: "riverside", flags: ["outdoors"], exits: { south: "zennor.mill-lane" } },
    { id: "zennor.carn-bridge", name: "Carn Bridge", district: "riverside", flags: ["listed", "outdoors"], exits: { east: "zennor.mill-lane" } },
    { id: "zennor.tram-riverside", name: "Riverside Station", district: "riverside", flags: ["listed"], exits: { southwest: "zennor.embankment" } },
    { id: "zennor.leat-walk", name: "Leat Walk", district: "riverside", flags: ["outdoors"], exits: { north: "zennor.embankment", east: "zennor.water-house", south: "zennor.terrace-road" } },
    { id: "zennor.water-house", name: "Water House", district: "riverside", flags: ["listed"], exits: { west: "zennor.leat-walk" } },
    // the Terraces
    { id: "zennor.terrace-road", name: "Terrace Road", district: "terraces", flags: ["outdoors"], exits: { north: "zennor.leat-walk", east: "zennor.seed-house", south: "zennor.terraces" } },
    { id: "zennor.seed-house", name: "Seed House", district: "terraces", flags: ["listed"], exits: { west: "zennor.terrace-road" } },
    { id: "zennor.terraces", name: "The Terraces", district: "terraces", flags: ["listed", "outdoors"], exits: { north: "zennor.terrace-road", south: "zennor.lower-terraces" } },
    { id: "zennor.lower-terraces", name: "Lower Terraces", district: "terraces", flags: ["outdoors"], exits: { north: "zennor.terraces" } },
  ],
  cars: [
    { id: "zennor.tram", name: "The Tram", kind: "tram", stops: ["zennor.tram-riverside", "zennor.tram-market", "zennor.tram-uptown", "zennor.tram-downs"] },
  ],
};

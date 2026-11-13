// Land board preview: draws a walk on the board of octagons (ui/land-deck.js) under Tamsin from
// above (ui/land-globe.js), for comparing with the picked mockup (docs/maps/reference/land-picked-mockup.html).
//
//   ?walk=URL   a walk as the mockup's WALK ({places, here}, exits keyed by full words); without it,
//               the mockup's own WALK
//   ?cx=&cy=&k= centre the view on (cx, cy) km, north-up, at k px a km (the mockup's: 8.4, -2.6, 24);
//               without them, home(): on you at 26 px a km
//   ?target=NAME light the route to the first place with that name (or id), as a click does
//   ?note=NAME  put a note on the first place with that name (default: the mockup's, the Old Shaft
//               on the Terrace Track)

import land from "../ui/data/land.js";
import sky from "../ui/data/sky.js";
import { LandDeck } from "../ui/land-deck.js";
import { LandGlobe } from "../ui/land-globe.js";
import { LandStore } from "../ui/lib/land-store.js";

const SHORT = { north: "n", northeast: "ne", east: "e", southeast: "se", south: "s", southwest: "sw", west: "w", northwest: "nw" };
const q = new URLSearchParams(location.search);

async function loadWalk() {
  if (q.get("walk")) return (await fetch(q.get("walk"))).json();
  const html = await (await fetch("../docs/maps/reference/land-picked-mockup.html")).text();
  return JSON.parse(html.match(/const WALK = (\{.*\});/)[1]);
}

/** The walk's places as a land-room frame each, in walk order, so the store sees them as the panel would. */
function frames(walk) {
  const byId = new Map(walk.places.map((p) => [p.id, p]));
  return walk.places.map((p) => {
    const exits = {};
    for (const [word, e] of Object.entries(p.exits)) {
      if (!e.to || !SHORT[word]) continue;
      const exit = { id: e.to };
      if (!e.to.startsWith("surface.")) exit.area = "zennor";
      const t = byId.get(e.to);
      const back = t && Object.entries(t.exits).find(([, b]) => b.to === p.id)?.[0];
      if (back) exit.inverse = back;
      exits[SHORT[word].toUpperCase()] = exit;
    }
    return { id: p.id, name: p.name, coords: { x: p.x, y: p.y, z: p.z }, exits };
  });
}

const walk = await loadWalk();
const store = new LandStore();
for (const fr of frames(walk)) store.ingest(fr);
store.ingest(frames(walk).find((fr) => fr.id === walk.here));
const noted = store.places().find((p) => p.name === (q.get("note") ?? "Old Shaft on the Terrace Track"));
if (noted) store.setNote(noted.id, "a note");

const here = walk.places.find((p) => p.id === walk.here);
new LandGlobe(document.getElementById("model"), { latitude: sky.zennor.latitude, body: "tamsin" }).set({ x: here?.x ?? 0, y: here?.y ?? 0 });

const deck = new LandDeck(document.getElementById("deck"), land.tamsin, "tamsin");
deck.draw(store);
if (q.has("k")) {
  deck.measure();
  deck.centre(+q.get("cx"), -q.get("cy"), +q.get("k"));
} else deck.home();
deck.onNote((id, text) => {
  store.setNote(id, text);
  deck.draw(store);
});
deck.onForget(() => {
  store.forget("surface.tamsin.");
  deck.draw(store);
});
if (q.get("target")) deck.setTarget(store.places().find((p) => p.name === q.get("target") || p.id === q.get("target"))?.id ?? null);
window.deck = deck;
document.body.dataset.ready = "1";

// The octagons' grounds on the land's map (spec, "Drawing the board"; style guide §4.2): a colour
// for each kind of ground, and over it a texture drawn as an SVG pattern in screen pixels, so it's
// the same size at any zoom. Shapes, line colours and opacities are the picked mockup's
// (docs/maps/reference/land-picked-mockup.html). Pure (no DOM).

const GROUNDS = {
  open: { fill: "#261f18" },
  road: { fill: "#332b22" }, // Earth
  waymark: { fill: "#2f2820", pattern: { w: 8, h: 8, svg: `<rect x="3.4" y="1.5" width="1.4" height="5" fill="#b3a58f" fill-opacity=".55"/>` } },
  high: { fill: "#3b3722", pattern: { w: 9, h: 7, svg: `<path d="M1.5,5.5 L4.5,1.8 L7.5,5.5" fill="none" stroke="#c8b97e" stroke-width=".85" stroke-opacity=".55"/>` } },
  slope: { fill: "#33291c", pattern: { w: 5, h: 5, svg: `<path d="M0,5 L5,0" stroke="#a8977c" stroke-width=".8" stroke-opacity=".45"/>` } },
  low: { fill: "#1f2619", pattern: { w: 9, h: 7, svg: `<path d="M1.5,1.8 L4.5,5.5 L7.5,1.8" fill="none" stroke="#7f9c68" stroke-width=".85" stroke-opacity=".6"/>` } },
  rock: {
    fill: "#34363a",
    pattern: { w: 11, h: 10, svg: `<path d="M2,3 l2,-1.6 l1.4,2 Z M7.5,7.5 l2,-1.2 l.6,2.2 Z M8,1.5 l1.2,.8 l-1.6,.8 Z" fill="#a4a4a8" fill-opacity=".55"/>` },
  },
  dust: {
    fill: "#4a3a22",
    pattern: { w: 5, h: 5, svg: `<circle cx="1.2" cy="1.2" r=".75" fill="#c9a36a" fill-opacity=".5"/><circle cx="3.7" cy="3.7" r=".6" fill="#c9a36a" fill-opacity=".35"/>` },
  },
  workings: {
    fill: "#4a2a1e",
    pattern: { w: 12, h: 9, svg: `<path d="M1,7 q3,-6 6,0 M7,3.5 q2.2,-4 4.4,0" fill="none" stroke="#c07a5c" stroke-width=".9" stroke-opacity=".7"/>` },
  },
  water: { fill: "#1f3a52", pattern: { w: 12, h: 6, svg: `<path d="M0,3 q3,-2.4 6,0 t6,0" fill="none" stroke="#5b86ad" stroke-width=".9" stroke-opacity=".75"/>` } },
  salt: { fill: "#4c4a42", pattern: { w: 7, h: 7, svg: `<rect x="1.5" y="1.5" width="4" height="4" fill="none" stroke="#cfc9b9" stroke-width=".6" stroke-opacity=".45"/>` } },
  ice: { fill: "#5a6878", pattern: { w: 6, h: 6, svg: `<path d="M0,6 L6,0" stroke="#dbe9ff" stroke-width=".7" stroke-opacity=".45"/>` } },
    // the six of the game's terrains (gmcp.md §9.5.1) with no title group: its hues brought down to
  // the board's dark earth (reference/land-terrain-options.png, A). Water, ice, salt, rock and
  // dust are the groups' own.
  woods: { fill: "#1e3522", pattern: { w: 9, h: 9, svg: `<circle cx="2.5" cy="2.5" r="1.5" fill="#79b07c" fill-opacity=".55"/><circle cx="7" cy="6.8" r="1.3" fill="#79b07c" fill-opacity=".45"/>` } },
  reeds: { fill: "#21443a", pattern: { w: 7, h: 8, svg: `<path d="M1.5,7 V2 M3.2,7 V3.2 M5,7 V1.8" stroke="#8fd0b8" stroke-width=".7" stroke-opacity=".55"/>` } },
  scrub: {
    fill: "#2e3a1c",
    pattern: { w: 9, h: 8, svg: `<path d="M1.5,5.5 L3,3.5 L4.5,5.5 M5.5,2.5 L6.8,1 L8,2.5" fill="none" stroke="#a4bf74" stroke-width=".75" stroke-opacity=".55"/>` },
  },
  cushions: { fill: "#3a4224", pattern: { w: 9, h: 7, svg: `<path d="M1,5 a2,1.8 0 0 1 4,0 Z M5.5,2.5 a1.6,1.4 0 0 1 3.2,0 Z" fill="#c4cf8e" fill-opacity=".45"/>` } },
  stones: {
    fill: "#403c34",
    pattern: {
      w: 8,
      h: 8,
      svg: `<circle cx="2" cy="2.2" r="1" fill="none" stroke="#cfc6b4" stroke-width=".6" stroke-opacity=".55"/><circle cx="5.8" cy="5.6" r=".8" fill="none" stroke="#cfc6b4" stroke-width=".6" stroke-opacity=".45"/>`,
    },
  },
  earth: { fill: "#4a2619", pattern: { w: 7, h: 7, svg: `<path d="M1,2 h1.6 M4.2,5 h1.6" stroke="#c49466" stroke-width=".7" stroke-opacity=".5"/>` } },
  // the shore of molten rock: black crust, glowing cracks (reference/molten-ground-options.png, A)
  molten: {
    fill: "#241816",
    pattern: { w: 12, h: 10, svg: `<path d="M0,6 L3,4.5 L5,6.5 L8,3 L12,5 M8,3 L9,0" fill="none" stroke="#e0552b" stroke-width=".9" stroke-opacity=".8"/>` },
  },
};

/**
 * A kind of ground's colour, and its texture: a tile w × h screen pixels whose markup is svg.
 * An unknown one is open ground.
 * @param {string} group one of GROUPS or TERRAINS in ./land-kinds.js (as groundOf gives)
 * @returns {{fill: string, pattern?: {w: number, h: number, svg: string}}}
 */
export function groundStyle(group) {
  return GROUNDS[group] ?? GROUNDS.open;
}

// Pure geometry for the station model: constants, districts and the camera.
// No DOM; safe to load as a browser ES module.

export const RING = ["Rim", "Mid", "Inner", "Hub"];
export const STEP = [2, 3, 3]; // x units between corridor stops, per ring
export const SPOKE_HOURS = [0, 3, 6, 9];
export const WRAP = 24;

export const DISTRICT_COLOURS = {
  concourse: "#d9a441",
  residential: "#5b8def",
  hydroponics: "#4caf7a",
  commons: "#a57be0",
  offices: "#3fb6b2",
  midring: "#8796a8",
  industrial: "#d0703c",
  docks: "#cfe3ff",
  hub: "#cfe3ff",
};

// Ring radii, ring thicknesses and ring half-widths (along the station axis).
export const RR = [300, 205, 115];
export const RT = [22, 18, 16];
export const RWZ = [46, 34, 32];

export const HUBR = 32;
export const HUBZ = 34;
export const SPR = 18;
export const SPZ = (n) => 58 + 72 * n;
export const BLZ = SPZ(4) + 40;

// Deck slices across a ring: aft2 | aft1 | corridor | fore1 | fore2, as fractions of the deck width.
export const SLICE = [-1, -0.6, -0.2, 0.2, 0.6, 1];
export const CAM = { yaw: 16, pitch: 38 };

/** Hours (0-12 around the clock face) to radians. */
export const ang = (h) => (h / 12) * 2 * Math.PI;

/** A point at radius r, clock hour h and axial position z. */
export const P3 = (r, h, z) => [r * Math.sin(ang(h)), r * Math.cos(ang(h)), z];

/** Turn the wheel about its axis so a point at hour h ends up at h + phiHours. */
export function roll(p, phiHours) {
  const c = Math.cos(ang(phiHours));
  const s = Math.sin(ang(phiHours));
  return [p[0] * c + p[1] * s, -p[0] * s + p[1] * c, p[2]];
}

/**
 * A camera at `yaw` and `pitch` degrees: its projection (yaw about Y, then pitch about X; screen y
 * is down, larger depth is nearer) and its front, the hour on the wheel nearest it, whatever sits
 * there facing the viewer.
 */
export function camera({ yaw, pitch }) {
  const Y = (yaw * Math.PI) / 180;
  const X = (pitch * Math.PI) / 180;
  const [cy, sy, cx, sx] = [Math.cos(Y), Math.sin(Y), Math.cos(X), Math.sin(X)];
  return {
    project([x, y, z]) {
      const x1 = x * cy + z * sy;
      const z1 = -x * sy + z * cy;
      return [x1, -(y * cx - z1 * sx), y * sx + z1 * cx];
    },
    front: (Math.atan2(-sy * cx, sx) / (2 * Math.PI)) * 12,
  };
}

const DEFAULT = camera(CAM);

/** The default camera's projection. */
export const project = DEFAULT.project;

/** The hour on the wheel nearest the default camera: whatever sits there faces the viewer. */
export const FRONT = DEFAULT.front;

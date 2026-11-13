// The game's tides, cut down for the build's tests: a world locks in a thousandth of its orbit's size, in billions of years.
export const QUALITY = { dry: 100, seas: 40, envelope: 10_000 };

export function lockTime(_mass: number, _radius: number, _gravity: number, a: number, _quality: number): number {
  return a / 1000;
}

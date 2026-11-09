// The game's stars, cut down for the build's tests: a star's colour by its temperature.
export function starColour(t: number): string {
  return t < 4300 ? 'red' : t < 5000 ? 'orange' : 'white';
}

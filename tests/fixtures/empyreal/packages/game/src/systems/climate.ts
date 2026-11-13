// The game's climate, cut down for the build's tests: a world's mean is its sunlight's plus its
// greenhouse, and a substance is liquid between melting and boiling, ice below, gone above.
type Sub = { melts: number; boils: number; veil?: string };
type Climate = { albedo: number; air: number; greenhouse: number; gases?: Record<string, number>; volatiles: { of: string; amount: string }[] };
type T = { mean: number; bare: number };

export function sunlight(star: { temperature: number }, km: number): number {
  return (star.temperature / 4500) ** 4 * (6000 / km) ** 2;
}

export function temperatures(light: number, c: Climate): T {
  const bare = 280 * (light * (1 - c.albedo)) ** 0.25;
  return { bare, mean: bare + c.greenhouse };
}

export function phaseOf(s: Sub, _air: number, t: T): string {
  return t.mean < s.melts ? 'ice' : t.mean < s.boils ? 'liquid' : 'gone';
}

export function surfaceOf(v: { amount: string } | undefined, s: Sub | undefined, air: number, t: T): string {
  if (!v || !s) return 'none';
  const phase = phaseOf(s, air, t);
  if (phase === 'gone') return 'none';
  if (v.amount === 'trace') return 'trace';
  return phase === 'liquid' ? 'seas' : 'ice';
}

export function veilOf(c: Climate, _t: T, subs: ReadonlyMap<string, Sub>): string | undefined {
  for (const gas of Object.keys(c.gases ?? {})) if (subs.get(gas)?.veil) return subs.get(gas)!.veil;
  return undefined;
}

// A gaseous world, cut down: its 1-bar mean is its sunlight's plus its heat, and a locked one's night is 1,000 K.
type Envelope = { albedo: number; heat: number };
export function envelopeTemperatures(light: number, e: Envelope, _g: number, _day: number, locked: boolean, _cp: number) {
  const mean = 280 * (light * (1 - e.albedo)) ** 0.25 + e.heat;
  return { mean, noon: mean, night: locked ? 1000 : mean };
}

export function specificHeat(): number {
  return 14000;
}

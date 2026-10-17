// A seeded generator for the property tests (ADR 0031 §4). The same seed gives the same cases, so a failure names the seed and replays.
export interface Rng {
  next(): number;
  int(lo: number, hi: number): number;
  pick<T>(xs: readonly T[]): T;
  bool(p?: number): boolean;
}

export function rng(seed: number): Rng {
  let s = seed >>> 0;
  const next = (): number => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  return {
    next,
    int: (lo, hi) => Math.floor(lo + next() * (hi - lo + 1)),
    pick: xs => xs[Math.floor(next() * xs.length)]!,
    bool: (p = 0.5) => next() < p,
  };
}

/** Run `check` for `n` seeds; a failure says which seed to replay. */
export function forAll(n: number, check: (r: Rng, seed: number) => void, base = 1): void {
  for (let i = 0; i < n; i++) {
    const seed = base + i;
    try { check(rng(seed), seed); } catch (e) { (e as Error).message = `seed ${seed}: ${(e as Error).message}`; throw e; }
  }
}

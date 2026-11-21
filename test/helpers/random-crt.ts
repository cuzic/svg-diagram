// The random CRTs of ADR 0073's pinned figures (moved from scripts/crt-u6-measure/random-crt.ts, which still measures the same figures): 1-3 ANDs, 8-19 nodes, 4 directions.
// The labels are only full-width 'あ' (1em in every CJK font): the text widths, hence the layouts and the pinned numbers, do not depend on which Japanese font the machine has (CI's test job has Noto Sans CJK, the golden job Noto Sans JP).
// The figure's shape is scripts/crt-u6-measure/random-crt.ts's (the same random numbers), whose labels also have the node's id in Latin (font-dependent widths).
// A fixed seed: the figure #g is the same on every run, so a result can be pinned per figure (test/fixtures/crt-random-pins.json). The generator consumes the random numbers of
// every figure in order (one that does not draw is skipped by the caller, not here), so #g needs all the figures before it to be generated.
type RandomNode = {id: string; label: string};
type RandomLink = {from: string | string[]; to: string};
export interface RandomCrt {g: number; nodes: RandomNode[]; links: RandomLink[]; dir: 'up' | 'left' | 'down' | 'right'}

export function randomCrts(count: number): RandomCrt[] {
  let seed = 4711;
  const rnd = (): number => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const out: RandomCrt[] = [];
  for (let g = 0; g < count; g++) {
    const n = 8 + Math.floor(rnd() * 12);
    const nodes = Array.from({length: n}, (_, k) => ({id: `n${k}`, label: 'あ'.repeat(3 + Math.floor(rnd() * 10))}));
    const links: RandomLink[] = [], seen = new Set<string>();
    for (let k = 1; k < n; k++) { const f = Math.floor(rnd() * k); links.push({from: `n${f}`, to: `n${k}`}); seen.add(f + ':' + k); }
    const extra = Math.floor(n * (0.3 + rnd() * 0.6));
    for (let m = 0; m < extra; m++) { const a = Math.floor(rnd() * n), b = Math.floor(rnd() * n); if (a >= b || seen.has(a + ':' + b)) continue; seen.add(a + ':' + b); links.push({from: `n${a}`, to: `n${b}`}); }
    const nand = 1 + Math.floor(rnd() * 3);
    for (let q = 0; q < nand; q++) { const b = 3 + Math.floor(rnd() * (n - 3)); const a1 = Math.floor(rnd() * b), a2 = Math.floor(rnd() * b); if (a1 !== a2 && !seen.has(a1 + ':' + b) && !seen.has(a2 + ':' + b)) { seen.add(a1 + ':' + b); seen.add(a2 + ':' + b); links.push({from: [`n${a1}`, `n${a2}`], to: `n${b}`}); } }
    out.push({g, nodes, links, dir: (['up', 'left', 'down', 'right'] as const)[Math.floor(rnd() * 4)]!});
  }
  return out;
}

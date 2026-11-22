// ADR 0075 D5 (U1): the cost of the row search is counted in layouts (every placement `layoutCauseBandAt` makes: it does not depend on the load of the machine), not in seconds.
// The benchmark trees of scripts/crt-u6-measure/timing.ts at 60 nodes (random links; the second has ANDs), with labels of 'あ' only so that no layout depends on a font. `main` = the layouts lib/ placed before the search.
// The 120-node trees take 5-30 s each and are measured by scripts/crt-u6-measure/lo-bench.sh (ADR 0075 U2).
import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/strict-width.ts';
import {causeTree, checkDiagram, closeMeasurer, diagram} from '../lib/dsl.ts';
import {searchStats} from '../lib/toc.ts';

test.after(() => closeMeasurer());

function tree(n: number, ands: boolean): {nodes: {id: string; label: string}[]; links: {from: string | string[]; to: string}[]} {
  let seed = 4242; const rnd = (): number => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const nodes = Array.from({length: n}, (_, k) => ({id: `n${k}`, label: 'あ'.repeat(3 + Math.floor(rnd() * 7))}));
  const links: {from: string | string[]; to: string}[] = [], seen = new Set<string>();
  for (let k = 1; k < n; k++) { const f = Math.max(0, k - 1 - Math.floor(rnd() * 6)); links.push({from: `n${f}`, to: `n${k}`}); seen.add(f + ':' + k); }
  for (let m = 0; m < n * 0.8; m++) { const a = Math.floor(rnd() * n), b = Math.min(n - 1, a + 2 + Math.floor(rnd() * 8)); if (a >= b || seen.has(a + ':' + b)) continue; seen.add(a + ':' + b); links.push({from: `n${a}`, to: `n${b}`}); }
  if (ands) for (let q = 0, used = new Set<number>(); q < 1 + Math.floor(n / 20); q++) { const b = 6 + Math.floor(rnd() * (n - 6)), a1 = Math.floor(rnd() * b), a2 = Math.floor(rnd() * b); if (a1 === a2 || used.has(b) || seen.has(a1 + ':' + b) || seen.has(a2 + ':' + b)) continue; used.add(b); seen.add(a1 + ':' + b); seen.add(a2 + ':' + b); links.push({from: [`n${a1}`, `n${a2}`], to: `n${b}`}); }
  return {nodes, links};
}

for (const [name, ands, main] of [['60 節 plain', false, 16], ['60 節 AND あり', true, 44]] as const) {
  test(`費用 (${name}): 配置の数が main (${main}) の +30% 以下で、焼きなましの手が上限 (2 回 x 5 x 3000) 以下`, async () => {
    const {nodes, links} = tree(60, ands);
    searchStats.layouts = 0; searchStats.moves = 0; searchStats.rowSearches = 0;
    await checkDiagram(diagram({theme: 'blue', width: 4000}).add(causeTree(nodes, links, {dir: 'up'}) as never));
    assert.ok(searchStats.layouts > main, `層の探索が配置を足している (${searchStats.layouts})`);
    assert.ok(searchStats.layouts <= 1.3 * main, `配置の数 ${main} -> ${searchStats.layouts} (+30% まで)`);
    assert.ok(searchStats.moves <= searchStats.rowSearches * 5 * 3000, `手の数 ${searchStats.moves}`);
  });
}

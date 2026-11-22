// ADR 0075 U1: the row search of a cause tree, on the pinned random CRTs (test/helpers/random-crt.ts, seed 4711; the first 300 plain, the first 150 canvas; labels 'あ' only, so no number depends on a font).
// test/fixtures/crt-layer-order-pins.json holds what lib/ of main drew (`main`, every figure, with the layouts it placed) and what this version draws for the figures whose route changes (`now`).
// P1 (ADR 0073 D1-3): no cause-crossing, AND crossing, sub-4px overlap or height (1.25 x) beyond main; the crossings rise only where an AND crossing falls. P3: the run pairs rise only where the crossings or the AND crossings fall.
// P4: the bends rise by more than 4 only where the crossings or the AND crossings fall, and by at most 8 per crossing removed (the measured maximum). The cost (D5): at most 4 layouts more per figure and 30% more in total.
// The property that guards the wiring of the final pick (D3): a figure differs from main's only when a rows candidate replaced main's pick, and then the window of ADR 0073 D2 over [M, R] selects R and R has no more overlaps.
import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/strict-width.ts';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {causeTree, checkDiagram, closeMeasurer, diagram} from '../lib/dsl.ts';
import {andClashes} from '../lib/cause-clash.ts';
import {bendsOf, crossingsOf, parallelRuns, runPairWays, runsOfRoute} from '../lib/polyline-metrics.ts';
import type {P as Pt} from '../lib/polyline-metrics.ts';
import {selectIndex} from '../lib/layered-route.ts';
import {searchHooks, searchStats} from '../lib/toc.ts';
import type {LaidOutCause} from '../lib/types/diagrams.ts';
import {randomCrts} from './helpers/random-crt.ts';

test.after(() => closeMeasurer());

type Row = [g: number, crossings: number, causeCrossing: number, andCrossings: number, pairs: number, bends: number, height: number, overlaps: number, layouts: number, hash: string];
interface Set_ {main: Row[]; now: Row[]}
const pins = JSON.parse(readFileSync(new URL('./fixtures/crt-layer-order-pins.json', import.meta.url), 'utf8')) as {plain: Set_; canvas: Set_};
const figures = randomCrts(300);
const pairsPlain = (P: Pt[][], sep: number): number => { const runs = P.map(p => runsOfRoute(p)); let n = 0; for (const [i, a] of runs.entries()) for (const b of runs.slice(i + 1)) { const w = runPairWays(a, b, sep); n += w.level + w.plumb; } return n; };

interface Drawn {row: Row; replaced: {m: {score: readonly number[]; overlaps: number}; r: {score: readonly number[]; overlaps: number}}[]}
async function drawn(g: number, canvas: boolean): Promise<Drawn> {
  const f = figures[g]!, replaced: Drawn['replaced'] = [];
  const d = canvas ? diagram({theme: 'blue', canvas: {width: 2400, height: 1800, minText: 18, fit: 'content'}}) : diagram({theme: 'blue', width: 1800});
  searchStats.layouts = 0; searchStats.replaced = 0; searchHooks.onReplace = (m, r) => { replaced.push({m, r}); };
  const r = await checkDiagram(d.add(causeTree(f.nodes, f.links, {tree: 'crt', dir: f.dir}) as never));
  searchHooks.onReplace = undefined;
  const t = r.laidOut.laidOut.find(b => b.type === 'cause') as LaidOutCause, P = t.edges.map(e => e.points);
  const and = andClashes(t.edges, t.ands).filter(c => c.how === 'crosses').length, hash = createHash('md5').update(JSON.stringify(P)).digest('hex').slice(0, 10);
  const cc = r.verdict.warnings.filter(w => w.startsWith('[cause-crossing]')).length;
  return {row: [g, crossingsOf(P), cc, and, pairsPlain(P, canvas ? 18 : 14), P.reduce((n, p) => n + bendsOf(p), 0), Math.round(t.h), parallelRuns(P, 4).length, searchStats.layouts, hash], replaced};
}

for (const [name, canvas] of [['幅 1800 の先頭 300 枚', false], ['canvas 2400x1800 (倍率 1.29) の先頭 150 枚', true]] as const) {
  const set = canvas ? pins.canvas : pins.plain, now = new Map(set.now.map(r => [r[0], r]));
  test(`行の並びの探索 (${name}): 図ごとの上限 (P1・P3・P4・費用)、ピン、最終の選びの性質`, async () => {
    let layoutsMain = 0, layoutsNow = 0, changed = 0;
    for (const m of set.main) {
      const g = m[0], {row: x, replaced} = await drawn(g, canvas), tag = `#${g}`;
      layoutsMain += m[8]; layoutsNow += x[8];
      const crossFell = x[1] < m[1] || x[3] < m[3];
      assert.ok(x[2] <= m[2], `${tag}: cause-crossing ${m[2]} -> ${x[2]}`);
      assert.ok(x[3] <= m[3], `${tag}: AND の交差 ${m[3]} -> ${x[3]}`);
      assert.ok(x[1] <= m[1] || x[3] < m[3], `${tag}: 交差 ${m[1]} -> ${x[1]} (増えてよいのは AND の交差が減る図だけ。ADR 0073 D1-3)`);
      assert.ok(x[7] <= m[7], `${tag}: 4px 未満の重なり ${m[7]} -> ${x[7]}`);
      assert.ok(x[6] <= 1.25 * m[6], `${tag}: 高さ ${m[6]} -> ${x[6]}`);
      assert.ok(x[4] <= m[4] || crossFell, `${tag}: 組 ${m[4]} -> ${x[4]} (増えてよいのは交差か AND の交差が減る図だけ。P3)`);
      const allowed = m[5] + 4 + (crossFell ? 8 * Math.max(0, m[1] - x[1]) + 8 * Math.max(0, m[3] - x[3]) : 0); // P4 (ADR 0075 Q3): beyond +4 only with a crossing removed, at most +8 each
      assert.ok(x[5] <= allowed, `${tag}: 折れ ${m[5]} -> ${x[5]} (上限 ${allowed})`);
      assert.ok(x[8] <= m[8] + 4, `${tag}: 配置の数 ${m[8]} -> ${x[8]} (main + 4 まで)`);
      // the wiring of the final pick (D3): the figure is main's unless a rows candidate replaced main's pick, and then the window selects it over main's pick
      if (x[9] !== m[9]) { changed++; assert.ok(replaced.length >= 1, `${tag}: 点列が変わったのに、層の探索の候補が main の選びを置き換えていない`); }
      if (replaced.length === 0) assert.equal(x[9], m[9], `${tag}: 層の探索の候補が採られていないのに点列が main と違う`);
      for (const {m: M, r: R} of replaced) {
        assert.equal(selectIndex([M.score, R.score]), 1, `${tag}: ADR 0073 の窓が [M, R] で R を選んでいない (${M.score} / ${R.score})`);
        assert.ok(R.overlaps <= M.overlaps, `${tag}: R の重なり ${R.overlaps} > M の ${M.overlaps}`);
      }
      const n = now.get(g); // the pins: a changed figure draws what it drew; an unchanged one draws what main drew (the same numbers and the same route)
      if (n) assert.deepEqual(x, n, tag); else assert.deepEqual(x.slice(0, 8).concat(x[9]), m.slice(0, 8).concat(m[9]), tag);
    }
    assert.equal(changed, set.now.length, `点列が変わる図 ${changed} 枚 (ピンは ${set.now.length} 枚)`);
    assert.ok(layoutsNow <= 1.3 * layoutsMain, `配置の数の合計 ${layoutsMain} -> ${layoutsNow} (+30% まで)`);
    assert.ok(layoutsNow > layoutsMain, '層の探索が配置を足している');
  });
}

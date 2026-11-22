// ADR 0073 U1 (D1), U2 (D2): the order search of a CRT takes a taller order only when it crosses less, and judges the height last. The pinned figures are random CRTs of a fixed seed
// (test/helpers/random-crt.ts; test/fixtures/crt-random-pins.json holds what lib/ of main (PR #406) drew for them and what this version draws). The labels are only 'あ' (full width in every Japanese font: CI's test job and
// its golden job have different ones), so the numbers do not depend on a font. P1: no more crossings than main (the AND crossings and the cause-crossing findings too), except where an AND crossing went away.
// P2: the height is within 1.25 x main's. P3 (U2): the run pairs do not grow, except in the figures the pins record, and not in total. P4 (U2): the bends are at most the bends of the same version with the pairs key off + 4, unless the AND crossings or the crossings fell (ADR 0075: the crossings too). The figures the search was changed for keep what they gained. The cost is counted in the orders the search laid out, not in time.
import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {causeTree, checkDiagram, closeMeasurer, diagram} from '../lib/dsl.ts';
import {andClashes} from '../lib/cause-clash.ts';
import {bendsOf, crossingsOf, parallelRuns, runPairWays, runsOfRoute} from '../lib/polyline-metrics.ts';
import type {P as Pt} from '../lib/polyline-metrics.ts';
import {searchStats} from '../lib/toc.ts';
import type {LaidOutCause} from '../lib/types/diagrams.ts';
import {randomCrts} from './helpers/random-crt.ts';

test.after(() => closeMeasurer());

type Row = [g: number, crossings: number, causeCrossing: number, andCrossings: number, pairs: number, bends: number, height: number, lineScaleDropped: number, laid: number, overlaps: number];
interface Set_ {pairsRecorded?: number[]; laneStep?: Record<string, string>; main: Row[]; now: Row[]; nopairs: Row[]; laid: {main: number; now: number}}
interface Pins {plain: Set_; canvas: Set_}
const pins = JSON.parse(readFileSync(new URL('./fixtures/crt-random-pins.json', import.meta.url), 'utf8')) as Pins;
const figures = randomCrts(300);
/** The run pairs the pins count: `runPairWays` over every two routes (the lib's `pairsOf` counts an overlap under 4px once more: ADR 0073 U2 M1; those are the `overlaps` column). */
const pairsPlain = (P: Pt[][], sep: number): number => { const runs = P.map(p => runsOfRoute(p)); let n = 0; for (const [i, a] of runs.entries()) for (const b of runs.slice(i + 1)) { const w = runPairWays(a, b, sep); n += w.level + w.plumb; } return n; };

/** One pinned figure drawn now: what the pins record for it. */
async function drawn(g: number, canvas: boolean): Promise<{hash: string; ov: number; c: number; cc: number; and: number; pairs: number; bends: number; h: number; lsd: number; laid: number}> {
  const f = figures[g]!;
  const d = canvas ? diagram({theme: 'blue', canvas: {width: 2400, height: 1800, minText: 18, fit: 'content'}}) : diagram({theme: 'blue', width: 1800});
  searchStats.laid = 0;
  const r = await checkDiagram(d.add(causeTree(f.nodes, f.links, {tree: 'crt', dir: f.dir}) as never));
  const laid = searchStats.laid;
  const t = r.laidOut.laidOut.find(b => b.type === 'cause') as LaidOutCause;
  const P = t.edges.map(e => e.points);
  const and = andClashes(t.edges, t.ands).filter(c => c.how === 'crosses').length; // the AND crossings of the search's score (ADR 0073 D1-3)
  const pairs = pairsPlain(P, canvas ? 18 : 14), bends = P.reduce((n, p) => n + bendsOf(p), 0); // 18 = the lane step of the canvas's lines (14 x 1.29, rounded)
  return {hash: createHash('md5').update(JSON.stringify(P)).digest('hex').slice(0, 10), ov: parallelRuns(P, 4).length, c: crossingsOf(P), pairs, bends, cc: r.verdict.warnings.filter(w => w.startsWith('[cause-crossing]')).length, and, h: Math.round(t.h), lsd: t.lineScaleDropped ? 1 : 0, laid};
}

for (const [name, canvas] of [['幅 1800', false], ['canvas 2400x1800 (倍率 1.29)', true]] as const) {
  const set = canvas ? pins.canvas : pins.plain;
  test(`ピンの図 (${name}): P1 交差・AND の交差・cause-crossing が main より増えない (AND の交差が減った図は除く)、P2 高さ ≤ 1.25 × main、倍率の線を外させない、費用 (配置した並びの数) が main 以下`, async () => {
    const now = new Map(set.now.map(r => [r[0], r]));
    let laid = 0, gained = 0;
    for (const m of set.main) {
      const g = m[0], x = await drawn(g, canvas), tag = `#${g}`;
      laid += x.laid;
      assert.ok(x.and <= m[3], `${tag}: AND の交差 ${m[3]} -> ${x.and}`);
      assert.ok(x.cc <= m[2], `${tag}: cause-crossing ${m[2]} -> ${x.cc}`);
      assert.ok(x.c <= m[1] || x.and < m[3], `${tag}: 交差 ${m[1]} -> ${x.c}`); // P1 (ADR 0073 D1-3): 増えてよいのは AND の交差が減ったときだけ
      assert.ok(x.h <= 1.25 * m[6], `${tag}: 高さ ${m[6]} -> ${x.h} (1.25 倍の上限 ${1.25 * m[6]})`); // P2 (main の高さで見る: 最初の並びの高さは main の +0.5px 以上で、実測の最大は 1.243 倍)
      assert.ok(x.lsd <= m[7], `${tag}: 倍率の線が外れた`);
      const n = now.get(g);
      if (n) { // U1 で変わる図: 得た交差を保つ。高さは U1 の値を超えない
        assert.ok(x.c <= n[1] && x.cc <= n[2] && x.and <= n[3], `${tag}: U1 で得た交差 ${n.slice(1, 4)} が戻った (${x.c},${x.cc},${x.and})`);
        assert.ok(x.h <= n[6], `${tag}: 高さ ${n[6]} -> ${x.h}`);
        assert.ok(x.bends <= n[5], `${tag}: 折れ ${n[5]} -> ${x.bends} (U3 で得た折れが戻った)`);
        if (x.c < m[1]) gained++;
      }
    }
    const expected = set.now.filter(n => n[1] < set.main.find(m => m[0] === n[0])![1]).length;
    assert.ok(expected >= 3 && gained >= expected, `交差が減る図 ${gained} 枚 (ピンは ${expected} 枚)`);
    assert.ok(laid <= set.laid.main, `配置した並びの数 ${laid} <= main の ${set.laid.main}`);
  });
}

for (const [name, canvas] of [['幅 1800', false], ['canvas 2400x1800 (倍率 1.29)', true]] as const) {
  const set = canvas ? pins.canvas : pins.plain;
  test(`ピンの図 (${name}): P3 組は交差か AND の交差が減った図以外で増えず、合計も増えない。同じ線の上の重なり (4px 未満) が main より増えない。P4 折れは「組の key を切った版 + 4」以下 (AND の交差・交差が減った図は除く)`, async () => {
    const now = new Map(set.now.map(r => [r[0], r])), off = new Map(set.nopairs.map(r => [r[0], r]));
    const recorded = new Set(set.pairsRecorded ?? []); // ADR 0073: the figures whose pairs rise with the crossings unchanged (the pairs key's exchange); recorded in the pins
    let total = 0, pinnedTotal = 0;
    for (const m of set.main) {
      const g = m[0], x = await drawn(g, canvas), tag = `#${g}`, n = now.get(g) ?? m, o = off.get(g)!;
      total += x.pairs; pinnedTotal += n[4];
      // These pins compare with the PR #406 baseline. cause-layer-order.test.ts checks P3 against main immediately before ADR 0075 U1.
      assert.ok(x.pairs <= m[4] || x.c < m[1] || x.and < m[3] || recorded.has(g), `${tag}: 組 ${m[4]} -> ${x.pairs} (増えてよいのは交差か AND の交差が減った図 (ADR 0075 の P3) と、ピンに記録した図 (ADR 0073))`); // 名前の一覧は持たない (ADR 0073)
      // plain #179 (ADR 0073 U3 review m3): the tails moved onto the heads make `first` leave the +4 window of the version without the pairs key, and it wins the pick; it gains a pair (recorded above), crossings unchanged
      if (!(g === 179 && !canvas)) assert.ok(x.bends <= o[5] + 4 || x.and < o[3] || x.c < o[1], `${tag}: 折れ ${o[5]} (組の key を切った版) -> ${x.bends} (+4 の上限、AND の交差 ${o[3]} -> ${x.and}、交差 ${o[1]} -> ${x.c})`); // ADR 0075 M5: the exception is a fall of the crossings too (a crossing reduction is not a pairs-only improvement)
      assert.equal(x.pairs, n[4], `${tag}: 組はピンのとおり`);
      assert.ok(x.ov <= m[9], `${tag}: 同じ線の上の重なり (4px 未満) ${m[9]} -> ${x.ov} (ADR 0070 U4c: 重なりを作らない)`);
    }
    // better() counts the pairs at the lane step of the figure's lines (18 on the canvas), not at 14: the figures whose route changes with 14 keep their route (the hash is of the points)
    for (const [g, hash] of Object.entries(set.laneStep ?? {})) assert.equal((await drawn(Number(g), canvas)).hash, hash, `#${g}: better() の組の間隔 (倍率つきの線の間隔)`);
    assert.ok(total <= pinnedTotal, `組の合計 ${total} <= ピン ${pinnedTotal}`);
  });
}

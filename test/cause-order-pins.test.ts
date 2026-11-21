// ADR 0073 U1 (D1): the order search of a CRT takes a taller order only when it crosses less, and judges the height last. The pinned figures are random CRTs of a fixed seed
// (test/helpers/random-crt.ts; test/fixtures/crt-random-pins.json holds what lib/ of main (PR #406) drew for them and what this version draws). The texts are the strict width's (the 'あ' x n of
// the generator), so the numbers do not depend on a font. P1: no more crossings than main (the AND crossings and the cause-crossing findings too), except where an AND crossing went away.
// P2: the height is within 1.25 x main's. The figures the search was changed for keep what they gained. The cost is counted in the orders the search laid out, not in time.
import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {causeTree, checkDiagram, closeMeasurer, diagram} from '../lib/dsl.ts';
import {crossingsOf} from '../lib/polyline-metrics.ts';
import {searchStats} from '../lib/toc.ts';
import type {LaidOutCause} from '../lib/types/diagrams.ts';
import {randomCrts} from './helpers/random-crt.ts';

test.after(() => closeMeasurer());

type Row = [g: number, crossings: number, causeCrossing: number, andCrossings: number, pairs: number, bends: number, height: number, lineScaleDropped: number, laid: number];
interface Pins {plain: {main: Row[]; now: Row[]; laid: {main: number; now: number}}; canvas: {main: Row[]; now: Row[]; laid: {main: number; now: number}}}
const pins = JSON.parse(readFileSync(new URL('./fixtures/crt-random-pins.json', import.meta.url), 'utf8')) as Pins;
const figures = randomCrts(150);

/** One pinned figure drawn now: what the pins record for it. */
async function drawn(g: number, canvas: boolean): Promise<{c: number; cc: number; and: number; h: number; lsd: number; laid: number}> {
  const f = figures[g]!;
  const d = canvas ? diagram({theme: 'blue', canvas: {width: 2400, height: 1800, minText: 18, fit: 'content'}}) : diagram({theme: 'blue', width: 1800});
  searchStats.laid = 0;
  const r = await checkDiagram(d.add(causeTree(f.nodes, f.links, {tree: 'crt', dir: f.dir}) as never));
  const laid = searchStats.laid;
  const t = r.laidOut.laidOut.find(b => b.type === 'cause') as LaidOutCause;
  const P = t.edges.map(e => e.points);
  const and = t.ands.map(a => crossingsOf(t.edges.filter(e => e.to === a.to && a.from.includes(e.from)).map(e => e.points))).reduce((s, x) => s + x, 0);
  return {c: crossingsOf(P), cc: r.verdict.warnings.filter(w => w.startsWith('[cause-crossing]')).length, and, h: Math.round(t.h), lsd: t.lineScaleDropped ? 1 : 0, laid};
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
        if (x.c < m[1]) gained++;
      }
    }
    assert.ok(gained >= 4, `交差が減る図 ${gained} 枚`);
    assert.ok(laid <= set.laid.main, `配置した並びの数 ${laid} <= main の ${set.laid.main}`);
  });
}

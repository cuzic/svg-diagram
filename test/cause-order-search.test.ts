// ADR 0073 U1 (D1): the rules of the order search of a CRT. Nothing here fixes a size in px that depends on a font: the figures are the pinned random CRTs (strict width, or a fixed text width),
// the heights are the figures' own, and the numbers are counts, orders and comparisons.
import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import path from 'node:path';
import {register} from 'node:module';
import {causeTree, checkDiagram, closeMeasurer, diagram} from '../lib/dsl.ts';
import type {Diagram} from '../lib/dsl.ts';
import {fitLineScale} from '../lib/layout.ts';
import {crossingsOf} from '../lib/polyline-metrics.ts';
import {adopts, layerRank, layoutCauseBand, layoutCauseBandOnce, lexLess, mayBeTaller} from '../lib/toc.ts';
import {lintDiagram} from '../lib/rules.ts';
import type {CauseBand, LaidOutCause} from '../lib/types/diagrams.ts';
import type {DiagramData} from '../lib/types/core.ts';
import type {LaidOutDiagram} from '../lib/types/index.ts';
import {loadDiagram} from '../lib/load-source.ts';
import {loadConfig} from '../lib/config.ts';
import {randomCrts} from './helpers/random-crt.ts';

register(new URL('../lib/resolve-hook.ts', import.meta.url)); // the examples import 'svg-diagram'

test.after(() => closeMeasurer());

const figures = randomCrts(150);
const bandOf = (g: number): CauseBand => { const f = figures[g]!; return causeTree(f.nodes, f.links, {tree: 'crt', dir: f.dir}); };
const fixedW = (t: string, size: number): number => t.length * size * 0.6;
const ROLES = {body: 14, note: 12} as never;
const lay = (band: CauseBand, env: object = {}, budget?: number): LaidOutCause => layoutCauseBand(band, 0, 0, 1800, fixedW as never, ROLES, {wrap: 'phrase', keepWords: false, ...env}, budget);
const crossings = (t: LaidOutCause): number => crossingsOf(t.edges.map(e => e.points));
/** The first order's figure: what the limits of the search are measured from (`base` in toc.ts). */
const baseOf = (band: CauseBand): LaidOutCause => layoutCauseBandOnce(band, 0, 0, 1800, fixedW as never, ROLES, {wrap: 'phrase', keepWords: false}, undefined, false, undefined, false, true);

test('mayBeTaller: 最初の並び + 0.5px まで / 1.25 倍ちょうど / 1.25 倍超 / 交差が best と同じ・多い (D1 (b)(c))', () => {
  const base = {h: 400}, best = {crossings: 4};
  assert.equal(mayBeTaller({h: 400.5, crossings: 9}, base, best), true, 'base + 0.5px までは、交差に依らず通る (今までのふるい)');
  assert.equal(mayBeTaller({h: 400.6, crossings: 9}, base, best), false, 'base + 0.5px を超えると、交差が減らない限り落ちる');
  assert.equal(mayBeTaller({h: 400.6, crossings: 3}, base, best), true);
  assert.equal(mayBeTaller({h: 500, crossings: 3}, base, best), true, '1.25 倍ちょうど');
  assert.equal(mayBeTaller({h: 500.1, crossings: 0}, base, best), false, '1.25 倍超は、交差がいくつ減っても落ちる');
  assert.equal(mayBeTaller({h: 450, crossings: 4}, base, best), false, '交差が best と同じ');
  assert.equal(mayBeTaller({h: 450, crossings: 5}, base, best), false, '交差が best より多い');
  // (3) AND の交差が減るが交差が増える高い候補は、(c-2) が止める
  assert.equal(mayBeTaller({h: 1.1 * 400, crossings: 5}, base, best), false);
});

test('mayBeTaller: 上限は base の高さ、交差の比べは best (best の高さは引数にない)', () => {
  const base = {h: 400}, best = {crossings: 4, h: 480}; // 走っている最良が 1.2 倍でも、上限は base の 1.25 倍のまま
  assert.equal(mayBeTaller({h: 1.3 * 400, crossings: 3}, base, best), false);
  assert.equal(mayBeTaller({h: 1.2 * 400, crossings: 3}, base, best), true);
  assert.equal(mayBeTaller({h: 1.2 * 400, crossings: 4}, base, best), false);
  assert.equal(mayBeTaller.length, 3, '(t, base, best) の 3 引数 (best の高さを取らない)');
});

test('lexLess と adopts: AND を先に比べる順を保つ (b)。高い候補は交差が減るときだけ。高さは最後の key', () => {
  assert.equal(lexLess([0, 0, 5, 9, 400], [1, 0, 4, 9, 400]), true, 'AND の交差が 0 の [0, 0, 5, …] が [1, 0, 4, …] に勝つ');
  const base = {h: 400};
  assert.equal(adopts(400, [0, 0, 5, 9, 400], base, [1, 0, 4, 9, 400]), true, '(b) では、交差の増える候補が採られうる (ADR 0019 D4 のまま)');
  assert.equal(adopts(440, [0, 0, 5, 9, 440], base, [1, 0, 4, 9, 400]), false, '高い候補 (c) では、AND の交差が減っても交差が増えれば採られない');
  assert.equal(adopts(440, [1, 0, 3, 9, 440], base, [1, 0, 4, 9, 400]), true, '交差が減る高い候補は採られる');
  assert.equal(adopts(440, [1, 0, 3, 9, 440], base, [1, 0, 4, 9, 400], false), false, '交換なし (exchange: false): base + 0.5px まで');
  assert.equal(lexLess([0, 0, 2, 1, 6, 400], [0, 0, 2, 1, 6, 420]), true, '同じ採点なら低い並びが勝つ (高さの最後の key)');
  assert.equal(lexLess([0, 0, 2, 1, 6, 420], [0, 0, 2, 1, 6, 400]), false);
  assert.equal(lexLess([0, 0, 2, 1, 7, 300], [0, 0, 2, 1, 6, 420]), false, '高さは最後: 折れが多ければ低くても勝たない');
  assert.equal(adopts(380, [0, 0, 2, 1, 6, 380], base, [0, 0, 2, 1, 6, 400]), true, '高さだけの改善も採られる (lastBetter が更新される)');
  assert.equal(adopts(400, [0, 0, 2, 1, 6, 400], base, [0, 0, 2, 1, 6, 400]), false, '同じ採点は採られない');
});

test('layerRank: 隙間の大きさが違うだけの配置は同じ層、0.5px を超える差は別の順位、格子の境界をまたぐ 0.02px の差は同じ順位 (D1 (e))', () => {
  assert.deepEqual(layerRank([10, 10, 50, 50, 120]), [0, 0, 1, 1, 2]);
  assert.deepEqual(layerRank([10, 10, 80, 80, 150]), layerRank([10, 10, 50, 50, 120]), '座標の値は違っても順位が同じなら同じ層');
  assert.deepEqual(layerRank([10, 10.4, 10.9]), [0, 0, 0], '隣り合う差が 0.5px 以内なら、連なって同じ順位');
  assert.deepEqual(layerRank([10, 10.51]), [0, 1], '0.5px を超える差は別の順位');
  assert.deepEqual(layerRank([10.24, 10.26]), [0, 0], '0.5 の格子の境界 (10.25) をまたぐ 0.02px は同じ順位 (丸める版は別に分けた)');
  assert.deepEqual(layerRank([3, 1, 2, 1]), [2, 0, 1, 0], '昇順の順位。入力の順のまま返す');
});

// 順序探索 (小さい図): 乱数の CRT のうち、高さの交換で交差が減る図 (固定の字幅。#70 #86 #101 #106 #132)
for (const g of [70, 86, 101, 106, 132]) {
  test(`交換: #${g} は高さが最初の並びの 1.25 倍以内で交差が減る並びを採り、交換なし (旧来のふるい) では採らない`, () => {
    const band = bandOf(g), base = baseOf(band);
    const on = lay(band), off = lay(band, {exchange: false});
    assert.ok(off.h <= base.h + 0.5, `交換なし ${off.h} は最初の並び ${base.h} + 0.5px 以下 (今までのふるい)`);
    assert.ok(crossings(on) < crossings(off), `交差 ${crossings(off)} -> ${crossings(on)}`);
    assert.ok(on.h > base.h + 0.5, `交換ありは高い: ${base.h} -> ${on.h} (前提: ふるいを通らない並びが採られた)`);
    assert.ok(on.h <= 1.25 * base.h, `高さ ${on.h} は最初の並び ${base.h} の 1.25 倍以内`);
  });
}

test('whyWhyTree の帯は探索の規則 (交換・高さの key) の外: 旗に依らず同じ (ADR 0073 は causeTree の帯だけ)', () => {
  const why = (env: object): LaidOutCause => layoutCauseBand({...bandOf(70), layerFrom: 'effect'} as CauseBand, 0, 0, 1800, fixedW as never, ROLES, {wrap: 'phrase', keepWords: false, ...env});
  assert.ok(crossings(lay(bandOf(70))) !== crossings(lay(bandOf(70), {exchange: false})), '前提: causeTree の帯では旗で図が変わる');
  assert.deepEqual(why({}).edges, why({exchange: false}).edges);
});

test('予算 (heightBudget) を超える並びは落ちる: 帯の高さの予算が高い並びに足りなければ、交換なしと同じ図 (D1 (7))', () => {
  const band = bandOf(70), on = lay(band), off = lay(band, {exchange: false});
  assert.ok(on.h > off.h, `前提: 交換ありが高い ${off.h} -> ${on.h}`);
  const budget = off.h + Math.floor((on.h - off.h) / 2);
  const squeezed = lay(band, {}, budget);
  assert.deepEqual(squeezed.edges, off.edges, '高い並びは予算で落ち、交換なしと同じ');
  assert.deepEqual(lay(band, {}, on.h + 1).edges, on.edges, '予算が足りるなら、交換ありの図');
});

// canvas: 図全体の再配置の順 (D1 (g))
const F = randomCrts(80);
const canvasOf = (g: number, height: number, n = 1): Diagram => {
  let d = diagram({theme: 'blue', title: 'T', showTitle: true, legend: 'auto', sourceLine: 'S', canvas: {width: 2400, height, minText: 18, fit: 'content'}} as never);
  for (let k = 0; k < n; k++) { const pre = k ? 'z' : '', f = F[g]!; d = d.add(causeTree(f.nodes.map(x => ({...x, id: pre + x.id})), f.links.map(l => ({from: typeof l.from === 'string' ? pre + l.from : l.from.map(x => pre + x), to: pre + l.to})), {tree: 'crt', dir: f.dir}) as never); }
  return d;
};
const tryCanvas = async (g: number, height: number, n = 1) => { try { return await checkDiagram(canvasOf(g, height, n)); } catch { return undefined; } };
const causeBands = (r: {laidOut: {laidOut: LaidOutDiagram['laidOut']}}): LaidOutCause[] => r.laidOut.laidOut.filter(b => b.type === 'cause') as LaidOutCause[];
const droppedAt = (r: {laidOut: {laidOut: LaidOutDiagram['laidOut']}}): boolean[] => causeBands(r).map(b => b.lineScaleDropped === true);

for (const n of [1, 2]) {
  test(`canvas (${n === 1 ? '帯 1 つ' : '同じ図を 2 つ縦に並べた 2 つの帯'}) #42: 交換ありだと図全体が canvas を超えるとき、倍率の線を外す前に、交換なしで倍率つきを描く (D1 (g))`, async () => {
    const g = 42;
    const roomy = (await tryCanvas(g, 100000, n))!, cOn = roomy.laidOut.contentHeight!, bandOn = causeBands(roomy)[0]!.h;
    // 交換なしの図全体の高さ: canvas を 1px 足りなくすると、再配置 (2) の図が返る (前提を下で確かめる)
    const squeezed = (await tryCanvas(g, cOn - 1, n))!, cOff = squeezed.laidOut.contentHeight!;
    assert.ok(cOff < cOn, `前提: 交換ありの図 ${cOn} は交換なしの図 ${cOff} より高い`);
    assert.deepEqual(droppedAt(squeezed), droppedAt(squeezed).map(() => false));
    const H = cOff + Math.floor((cOn - cOff) / 2);
    assert.ok(bandOn <= H && H < cOn, `前提: 帯 ${bandOn} は予算 (canvas の高さ ${H}) を通り、図全体 ${cOn} は超える (そうでないと、帯の予算で落ちただけで、再配置の道が走らない)`);
    const r = (await tryCanvas(g, H, n))!;
    assert.deepEqual(droppedAt(r), causeBands(r).map(() => false), '倍率の線は外れない');
    assert.ok(r.laidOut.contentHeight! <= H);
    assert.equal(lintDiagram(r.laidOut).filter(f => f.rule === 'cause-line-scale-dropped').length, 0);
    assert.equal(r.laidOut.contentHeight, cOff, '交換なしで描いた図全体');
    assert.deepEqual(causeBands(r).map(b => b.edges), causeBands(squeezed).map(b => b.edges), '帯の点列は、交換なしの描き方 (再配置 (2)) と同じ');
  });
}

test('canvas #42: 交換なしでも収まらなければ、今までどおり倍率の線を外す (D1 (g) (3))。倍率なしの図の高さの方が低い', async () => {
  const g = 42;
  const roomy = (await tryCanvas(g, 100000))!, cOn = roomy.laidOut.contentHeight!;
  const cOff = (await tryCanvas(g, cOn - 1))!.laidOut.contentHeight!;
  let lo = 1, hi = cOn;
  while (hi - lo > 4) { const mid = Math.floor((lo + hi) / 2); if (await tryCanvas(g, mid)) hi = mid; else lo = mid; }
  const cOld = (await tryCanvas(g, hi))!.laidOut.contentHeight!;
  assert.ok(cOld < cOff, `前提: 倍率なし ${cOld} < 交換なし・倍率つき ${cOff}`);
  const H = Math.floor((cOld + cOff) / 2);
  assert.ok(H < cOff && cOld <= H, `前提: 交換なしの倍率つき ${cOff} は収まらず、倍率なし ${cOld} は収まる (H ${H})`);
  const r = (await tryCanvas(g, H))!;
  assert.deepEqual(droppedAt(r), [true]);
  assert.ok(r.laidOut.contentHeight! <= H);
  assert.equal(lintDiagram(r.laidOut).filter(f => f.rule === 'cause-line-scale-dropped').length, 1);
});

test('fitLineScale (旗の単体): はみ出す配置に対して、交換あり → 交換なし・倍率つき → 倍率を 1 つずつ外す、の順に呼ぶ', () => {
  const data = {canvas: {width: 100, height: 100}} as unknown as DiagramData;
  const calls: string[] = [];
  const stub = (fits: (call: number) => boolean) => (lines: {seen: number; drop: number; exchange: boolean}): LaidOutDiagram => {
    calls.push(`${lines.exchange}/${lines.drop}`); lines.seen = 3; // 倍率を受ける帯が 3 つ
    return {contentHeight: fits(calls.length) ? 90 : 200} as unknown as LaidOutDiagram;
  };
  assert.equal(fitLineScale(data, stub(() => false)).contentHeight, 200);
  assert.deepEqual(calls, ['true/0', 'false/0', 'false/1', 'false/2', 'false/3'], '収まらなければ 1 + 1 + 帯の数 回');
  calls.length = 0;
  assert.equal(fitLineScale(data, stub(n => n === 2)).contentHeight, 90);
  assert.deepEqual(calls, ['true/0', 'false/0'], '交換なしで収まれば、そこで止まる');
  calls.length = 0;
  fitLineScale(data, stub(n => n === 1));
  assert.deepEqual(calls, ['true/0'], '収まれば再配置しない');
  calls.length = 0;
  assert.equal(fitLineScale(data, stub(n => n === 4)).contentHeight, 90);
  assert.deepEqual(calls, ['true/0', 'false/0', 'false/1', 'false/2']);
});

// ---- #397: toc-hop-all の高さ、高さの最後の key -------------------------------------------------------------------------------------------

test('#397: examples/toc-hop-all の帯は 505px のまま (U4b の後に症状は消えている。U1 の後も変わらない)', async () => {
  const r = await checkDiagram(await loadDiagram(path.join(import.meta.dirname, '../examples/toc-hop-all.ts'), loadConfig()));
  const t = r.laidOut.laidOut.find(b => b.type === 'cause') as LaidOutCause;
  assert.equal(Math.round(t.h), 505);
});

test('高さの最後の key: 乱数の幅 1800 の #99 は、採った高い候補が main の最終の図より高いまま残らない (main 631px、高さの key の前は +84px = 715px)', async () => {
  const f = figures[99]!;
  const r = await checkDiagram(diagram({theme: 'blue', width: 1800}).add(causeTree(f.nodes, f.links, {tree: 'crt', dir: f.dir}) as never));
  const t = r.laidOut.laidOut.find(b => b.type === 'cause') as LaidOutCause;
  assert.ok(Math.round(t.h) <= 631, `高さ ${Math.round(t.h)}`);
});

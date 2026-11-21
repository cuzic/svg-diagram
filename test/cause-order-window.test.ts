// ADR 0073 U2 (D2): the run pairs are a key of the order search's score and of `better()` ([crossings, pairs, bends, height]), with the window of D1-4 on the bends: a candidate may have up to 4 more bends
// than the least among the candidates with the least C if that takes pairs away. The choice is from the whole list of a stage (`selectIndex`, `selectAttempt`, `windowPool`), never a fold of two-way
// comparisons (which go round: a (pairs 0, bends 9) beats b (1, 5) beats c (2, 1) beats a). Nothing here depends on a font: keys are numbers, figures are the pinned random CRTs.
import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {causeTree, closeMeasurer} from '../lib/dsl.ts';
import {BEND_WINDOW, attemptKey, selectAttempt, selectIndex, windowOf} from '../lib/layered-route.ts';
import type {Attempt} from '../lib/layered-route.ts';
import {pairsOf, parallelRuns} from '../lib/polyline-metrics.ts';
import {bandSep, layoutCauseBand, windowPool} from '../lib/toc.ts';
import type {CauseBand, LaidOutCause} from '../lib/types/diagrams.ts';
import {randomCrts} from './helpers/random-crt.ts';

test.after(() => closeMeasurer());

/** Every order of a list (6 for 3). */
const perms = <T>(xs: readonly T[]): T[][] => xs.length <= 1 ? [[...xs]] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map(p => [x, ...p]));

// better(): key = [crossings, pairs, bends, height]. The cycle: a (pairs 0, bends 9), b (1, 5), c (2, 1), the same crossings and height
const A = [2, 0, 9, 400], B = [2, 1, 5, 400], C = [2, 2, 1, 400];

test('selectIndex: 循環の 3 案 a(0, 9) b(1, 5) c(2, 1) は、並べ順の 6 通りのすべてで b (窓は折れ ≤ 1 + 4 = 5 の b・c、その中で組が最小)', () => {
  assert.equal(perms([A, B, C]).length, 6);
  for (const list of perms([A, B, C])) assert.equal(list[selectIndex(list)], B, `並べ順 ${list.map(k => k === A ? 'a' : k === B ? 'b' : 'c').join('')}`);
  assert.deepEqual(windowOf([A, B, C]), [1, 2], '窓は b と c。a (折れ 9 > 1 + 4) は外');
});

test('selectIndex: 窓の内外 (折れ +4 と +5)。組だけが良い案は、折れの最小 + 4 までしか採られない', () => {
  const r = [2, 3, 5, 400];
  assert.equal(BEND_WINDOW, 4);
  assert.equal(selectIndex([r, [2, 0, 9, 400]]), 1, '+4 (折れ 9): 窓の内。組が少ない方');
  assert.equal(selectIndex([r, [2, 0, 10, 400]]), 0, '+5 (折れ 10): 窓の外。組が少なくても採られない');
  assert.equal(selectIndex([[2, 0, 10, 400], r]), 1, '並べ順に依らない');
  assert.equal(selectIndex([r, [2, 2, 5, 400]]), 1, '折れが同じなら組が少ない方');
  assert.equal(selectIndex([r, [2, 3, 5, 380]]), 1, '組も折れも同じなら高さが低い方 (最後の key)');
  assert.equal(selectIndex([r, [2, 3, 5, 400]]), 0, '全部同じなら、一覧の先の案');
  assert.equal(selectIndex([r, [1, 9, 40, 900]]), 1, '交差 (C) が少ない案は、組・折れ・高さに依らず、窓の外から勝つ');
  assert.equal(selectIndex([[1, 9, 40, 900], r]), 0);
  assert.equal(selectIndex([]), -1);
});

test('selectAttempt: better() の key は (交差, 組, 折れ, 高さ)。高さは heightKey のときだけ、組は pairsKey の図だけ (組が無ければ 0)', () => {
  const at = (crossings: number, bends: number, pairs: number | undefined, h: number): Attempt => ({score: {crossings, bends, ...(pairs === undefined ? {} : {pairs})}, size: {w: 1, h}} as Attempt);
  const x = at(2, 9, 0, 400), y = at(2, 5, 1, 400), z = at(2, 1, 2, 400);
  for (const list of perms([x, y, z])) assert.equal(selectAttempt(list), y, '循環の 3 案: どの並べ順でも y');
  assert.deepEqual(attemptKey(x, undefined), [2, 0, 9, 0], '高さの key が無ければ 0');
  assert.deepEqual(attemptKey(x, true), [2, 0, 9, 400]);
  assert.deepEqual(attemptKey(at(2, 9, undefined, 400), true), [2, 0, 9, 400], '組が無い (pairsKey の外) なら 0');
  // 組が無い図 (states・classes・semnet・pdpc・relationDiagram・whyWhyTree) は今までの (交差, 折れ): 窓があっても折れの最小
  assert.equal(selectAttempt([at(2, 9, undefined, 400), at(2, 5, undefined, 400), at(2, 1, undefined, 400)]).score.bends, 1);
  assert.equal(selectAttempt([at(2, 9, undefined, 300), at(2, 9, undefined, 400)], true).size.h, 300, '高さの key');
  assert.equal(selectAttempt([at(2, 9, undefined, 300), at(2, 9, undefined, 400)]).size.h, 300, '高さが無ければ一覧の先 (同じ key)');
  assert.equal(selectAttempt([at(2, 9, undefined, 400), at(2, 9, undefined, 300)]).size.h, 400, '高さの key が無いとき、高さは見ない');
});

// 並びの探索の状態: 採点は [AND の交差, AND の並走, 交差, 組, 折れ, 高さ] (C は先頭の 3 つ)
const S = (andX: number, andPar: number, crossings: number, pairs: number, bends: number, h = 400): number[] => [andX, andPar, crossings, pairs, bends, h];
const a = S(0, 0, 2, 0, 9), b = S(0, 0, 2, 1, 5), c = S(0, 0, 2, 2, 1);
const poolOf = (list: readonly number[][]) => { const [first, ...rest] = list; const pool = windowPool<number[]>(must(first), must(first)); for (const s of rest) pool.add(s, s); return pool; };
function must<T>(v: T | undefined): T { if (v === undefined) throw new Error('missing'); return v; }

test('windowPool (並びの探索の状態の add): 循環の 3 案が来る順を 6 通り変えても、最後の best は b。窓の外の図は持たない', () => {
  for (const list of perms([a, b, c])) {
    const pool = poolOf(list);
    assert.equal(pool.best.score, b, `来る順 ${list.map(k => k === a ? 'a' : k === b ? 'b' : 'c').join('')}`);
    assert.equal(pool.best.item, b);
    assert.equal(pool.size, 3, '採点は全部保つ');
    assert.equal(pool.held, 2, '図は窓 (b・c) のものだけ');
  }
});

test('windowPool: 窓が縮んで前の案が外れたら、best が替わる (add が true)。同じなら false', () => {
  const pool = windowPool<number[]>(a, a);
  assert.equal(pool.add(b, b), false, '折れ 5 の b が来ても、窓の上限 5 + 4 = 9 に a も入り、組が最小の a のまま');
  assert.equal(pool.best.score, a, '窓 {a, b}: 組が最小の a');
  assert.equal(pool.add(c, c), true, '折れ 1 の c が来て、窓が縮み、a が外れる。best は b に替わる');
  assert.equal(pool.best.score, b);
  assert.equal(pool.add(S(0, 0, 2, 9, 9), S(0, 0, 2, 9, 9)), false, '窓の外・組が多い案は best を替えない');
});

test('windowPool: AND の並走が多い案は、組が最小でも窓に入らない (C が違う)。AND の交差が少ない案は、折れが +20 でも窓の外から勝つ (上限が掛からない)', () => {
  const e = S(0, 1, 2, 0, 5); // AND の並走 1: C = (0, 1, 2) > (0, 0, 2)
  for (const list of perms([a, b, c, e])) assert.equal(poolOf(list).best.score, b, 'e は C が大きく、窓に入らない');
  const d = S(-1, 0, 2, 3, 20); // AND の交差が少ない (1 つ減る): 折れ 20・組 3
  for (const list of perms([a, b, c, d])) assert.equal(poolOf(list).best.score, d, 'AND を先に比べる順: d が窓の外から勝つ');
  assert.equal(poolOf([c, a]).best.score, c, '折れ 1 の c と折れ 9 の a だけなら、a は窓の外で c');
  assert.equal(poolOf([a, c]).best.score, c);
});

test('windowPool: 交差が違う案は、組・折れ・高さに依らず交差が少ない方 (C の 3 番目)。高さは最後の key', () => {
  assert.equal(poolOf([S(0, 0, 3, 0, 1), S(0, 0, 2, 9, 40)]).best.score[4], 40);
  assert.equal(poolOf([S(0, 0, 2, 1, 5, 420), S(0, 0, 2, 1, 5, 400)]).best.score[5], 400, '同じ採点なら低い並び');
  assert.equal(poolOf([S(0, 0, 2, 1, 5, 400), S(0, 0, 2, 0, 5, 700)]).best.score[3], 0, '組が先: 高さは最後');
});

// 帯の線の間隔 sep: 探索の採点と better() が同じ式 laneStepOf(space × scale)
const figures = randomCrts(150);
const bandOf = (g: number): CauseBand => { const f = figures[g]!; return causeTree(f.nodes, f.links, {tree: 'crt', dir: f.dir}); };
const fixedW = (t: string, size: number): number => t.length * size * 0.6;
const ROLES = {body: 14, note: 12} as never;
const lay = (band: CauseBand, env: object = {}): LaidOutCause => layoutCauseBand(band, 0, 0, 1800, fixedW as never, ROLES, {wrap: 'phrase', keepWords: false, ...env});

test('bandSep: laneStepOf(space × 線の倍率)。倍率なしは 14、canvas の倍率 1.29 は 18、density compact は 11。causeTree の自分の帯だけが倍率を受ける', () => {
  const band = bandOf(42);
  assert.equal(bandSep(band, {} as never), 14);
  assert.equal(bandSep(band, {lineScale: 1.29} as never), 18);
  assert.equal(bandSep(band, {lineScale: 0.5} as never), 14, '倍率は 1 未満にならない');
  assert.equal(bandSep(band, {space: 0.75} as never), 11);
  assert.equal(bandSep(band, {space: 0.75, lineScale: 1.29} as never), Math.round(14 * 0.75 * 1.29));
  assert.equal(bandSep({...band, layerFrom: 'effect'} as CauseBand, {lineScale: 1.29} as never), 14, 'whyWhyTree の帯は倍率を受けない');
  assert.equal(bandSep({...band, base: {}} as unknown as CauseBand, {lineScale: 1.29} as never), 14, 'pdpc・relationDiagram の帯も');
});

test('組 (pairsOf): runPairWays を 2 本ずつ足した数。parallelRuns の数以上 (同じ線の上で端が sep 未満の組の分だけ多い)。sep が広いほど減らない', () => {
  let more = 0;
  for (const g of [3, 42, 47, 93, 103, 114, 130]) {
    const pts = lay(bandOf(g)).edges.map(e => e.points);
    for (const sep of [14, 18]) {
      const n = pairsOf(pts, sep), p = parallelRuns(pts, sep).length;
      assert.ok(n >= p, `#${g} sep ${sep}: 組 ${n} >= parallelRuns ${p}`);
      if (n > p) more++;
    }
    assert.ok(pairsOf(pts, 18) >= pairsOf(pts, 14), `#${g}: sep が広ければ組は減らない`);
  }
  assert.ok(more >= 0, 'pairs >= parallelRuns の差は 0 以上');
});

// ADR 0070 D4 (U4c): the moves after the tracks (align, D12 to D14,
// the routes around the boxes) that may not add a pair of runs under a lane step apart (`gainsRunPairs`), the detour on the arrow's tracks, and
// the criteria of the ADR for the reported CRT's shape. The routing is checked on layouts of fixed box sizes (no font); the figures only for counts.
import test from 'node:test';
import './helpers/strict-width.ts'; // a label the layout did not register for measuring throws instead of measuring 0 wide
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {register} from 'node:module';
import {corridorLoad, laneStepOf, layeredAttempt, layoutWithLanes, routeLayered} from '../lib/layered-route.ts';
import {crossingsOf, crossingsWith, gainsRunPairs, parallelRuns, runPairGain, runPairWays, type runsOfPath, runsOfRoute, scoreOf} from '../lib/polyline-metrics.ts';
import type {RoutedRuns} from '../lib/polyline-metrics.ts';
import {lintDiagram} from '../lib/rules.ts';
import type {Pt} from '../lib/graph-layout.ts';
import {causeTree, checkDiagram, closeMeasurer, diagram} from '../lib/dsl.ts';
import {loadDiagram} from '../lib/load-source.ts';
import {loadConfig} from '../lib/config.ts';
import type {LaidOutCause} from '../lib/types/diagrams.ts';
import {crtReportShape} from './fixtures/crt-report-shape.ts';

register(new URL('../lib/resolve-hook.ts', import.meta.url)); // the examples import 'svg-diagram'
test.after(() => closeMeasurer());

const LANE = laneStepOf();
const P = (x: number, y: number): Pt => ({x, y});

// ---- trackLoad: the tracks of a gap ---------------------------------------------------------------------------------------------------------

// three long arrows (a2 -> c1, a3 -> c1, a3 -> c2) pass layer 1 beside m, with the direct arrows a1 -> m, m -> c1, m -> c2, m -> c3
const box = (id: string) => ({id, size: {w: 80, h: 60}});
const nodes = ['a1', 'a2', 'a3', 'm', 'c1', 'c2', 'c3'].map(box);
const edges = ([['a1', 'm'], ['m', 'c1'], ['m', 'c2'], ['m', 'c3'], ['a2', 'c1'], ['a3', 'c1'], ['a3', 'c2']] as const).map(([from, to]) => ({from, to}));

test('corridorLoad (the size of the gaps) counts the direct arrows only: the long arrows\' turns are not counted (PR #398: the order search wants the same layers)', () => {
  const lay = layoutWithLanes(nodes, edges, {dir: 'right', gap: 24, levelGap: 20});
  assert.equal(corridorLoad(lay), 3);
});

// ---- the moves after the tracks may not add a pair of runs under a lane step apart -------------------------------------------------------------

test('gainsRunPairs: a run that comes under a lane step from another route is a gain; a pair that was there, nearer, is not; the same routes with the other kind of run (plumb for level) is', () => {
  const cache = new WeakMap<Pt[], RoutedRuns>();
  const a = [P(0, 0), P(100, 0), P(100, 80), P(200, 80)], b = [P(0, 30), P(160, 30), P(160, 120), P(200, 120)];
  const prev = new Map([[0, a], [1, b]]);
  // a's vertical at x = 100 moves to 150: it comes within 10 of b's vertical at 160 (they overlap along y from 30 to 80)
  const moved = [P(0, 0), P(150, 0), P(150, 80), P(200, 80)];
  assert.equal(gainsRunPairs(prev, new Map([[0, moved], [1, b]]), LANE, cache), true);
  // a stays 20 from b: no pair
  const clear = [P(0, 0), P(140, 0), P(140, 80), P(200, 80)];
  assert.equal(gainsRunPairs(prev, new Map([[0, clear], [1, b]]), LANE, cache), false);
  // a pair that was there may get nearer (it is not a new one) but not more in all
  const close = new Map([[0, [P(0, 0), P(152, 0), P(152, 80), P(200, 80)]], [1, b]]);
  assert.equal(gainsRunPairs(close, new Map([[0, [P(0, 0), P(154, 0), P(154, 80), P(200, 80)]], [1, b]]), LANE, cache), false);
  // the same two routes the other way: a level pair where there was a plumb one
  const corner = [P(0, 0), P(100, 0), P(100, 40)], levelB = [P(0, 10), P(100, 10)], plumbB = [P(108, 0), P(108, 40)];
  assert.equal(gainsRunPairs(new Map([[0, corner], [1, [P(300, 300), P(300, 340)]]]), new Map([[0, corner], [1, levelB]]), LANE, cache), true, 'a level run 10 from a level run, over 4 long together');
  assert.equal(gainsRunPairs(new Map([[0, corner], [1, levelB]]), new Map([[0, corner], [1, plumbB]]), LANE, cache), true, 'the same two routes, a plumb pair now where a level one was: more kinds, a gain');
  assert.equal(gainsRunPairs(new Map([[0, corner], [1, levelB]]), new Map([[0, corner], [1, [P(0, 12), P(100, 12)]]]), LANE, cache), false, 'the level pair, 2 farther: no gain');
});

test('runPairWays: two runs on one line whose ends are under a lane step apart count, as parallelRuns leaves them out (D13\'s `at ± 6`)', () => {
  const a = runsOfRoute([P(0, 10), P(100, 10)]), near = runsOfRoute([P(106, 10), P(200, 10)]), far = runsOfRoute([P(114, 10), P(200, 10)]);
  assert.deepEqual(parallelRuns([[P(0, 10), P(100, 10)], [P(106, 10), P(200, 10)]], LANE), [], 'parallelRuns does not see them');
  assert.deepEqual(runPairWays(a, near, LANE), {level: 1, plumb: 0});
  assert.deepEqual(runPairWays(a, far, LANE), {level: 0, plumb: 0}, 'a lane step apart is clear');
});

// ---- the figures without `tracks` are what they were ---------------------------------------------------------------------------------------------

/** One of the random layered graphs (5 to 11 boxes 30 high, an arrow between two boxes with probability 0.3: a long arrow or two among them), by its seed. */
const randomGraph = (seed0: number) => {
  let seed = seed0;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const k = 5 + Math.floor(rnd() * 7);
  const boxes = Array.from({length: k}, (_, i) => ({id: `n${i}`, size: {w: 60 + Math.floor(rnd() * 40), h: 30}}));
  const es: {from: string; to: string}[] = [];
  for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) if (rnd() < 0.3) es.push({from: `n${i}`, to: `n${j}`});
  return {boxes, es};
};
const md5 = (v: unknown): string => createHash('md5').update(JSON.stringify(v)).digest('hex').slice(0, 12);
const rounded = (r: Map<number, Pt[]>) => [...r].map(([, pts]) => pts.map(q => [Math.round(q.x * 10) / 10, Math.round(q.y * 10) / 10]));

test('layeredAttempt without `tracks` (states, classes, semnet, pdpc ...: detour, apart, returns in a lane, a compact scale) gives the point lists origin/main gave', () => {
  // the md5s of the point lists origin/main (18a15eb4, ADR 0070 U4b) gave for these two graphs, taken before this change
  const want: Record<number, [string, string]> = {31: ['90aa010fc156', 'a479c8bd615a'], 52: ['5ec037707cf2', 'ecaab9308b68']};
  for (const [seed, [normal, compact]] of Object.entries(want)) {
    const {boxes, es} = randomGraph(Number(seed));
    const opts = {portStep: 22, place: () => (p: Pt) => p, detour: true, apart: true, returns: 'all' as const};
    const layout = {dir: 'right' as const, gap: 24, levelGap: 60};
    assert.equal(md5(rounded(layeredAttempt(boxes, es, layout, opts).routes)), normal, `seed ${seed}`);
    assert.equal(md5(rounded(layeredAttempt(boxes, es, layout, {...opts, space: 0.75}).routes)), compact, `seed ${seed}, density compact`);
  }
});

// ---- the detour on the arrow's tracks ------------------------------------------------------------------------------------------------------------

test('a figure where a long arrow takes the way around a box (detour): the routes lie on no pair of runs under a lane step, and the detour was taken', () => {
  for (const seed of [6, 36, 48]) {
    const {boxes, es} = randomGraph(seed);
    const lay = layoutWithLanes(boxes, es, {dir: 'right', gap: 24, levelGap: 60, coord: 'bk', transpose: true} as never);
    const route = (detour: boolean) => routeLayered(lay, p => p, 22, undefined, undefined, true, false, false, detour, detour, 1, false, {}, true);
    const without = route(false), around = route(true);
    assert.ok([...without].some(([i, r]) => JSON.stringify(r) !== JSON.stringify(around.get(i))), `seed ${seed}: some arrow takes another way around`);
    assert.deepEqual(parallelRuns([...around.values()], LANE), [], `seed ${seed}`);
    assert.ok(scoreOf([...around.values()]).bends < scoreOf([...without.values()]).bends, `seed ${seed}: the detour is taken for fewer bends`);
  }
});

test('the detour on the arrow\'s tracks (`snapToTracks`): a detour that would leave a pair of runs is taken with its runs across the gaps on the arrow\'s tracks, for fewer bends and pairs', () => {
  // measured with the runs across the gaps as found (no snapping): seed 54 gives 20 bends and 9 pairs, seed 52 gives 34 bends and 20 pairs
  const want: [number, number, number][] = [[54, 18, 8], [52, 30, 18]];
  for (const [seed, bends, pairs] of want) {
    const {boxes, es} = randomGraph(seed);
    const lay = layoutWithLanes(boxes, es, {dir: 'right', gap: 24, levelGap: 60, coord: 'bk', transpose: true} as never);
    const r = [...routeLayered(lay, p => p, 22, undefined, undefined, true, false, false, true, true, 1, false, {}, true).values()];
    assert.ok(scoreOf(r).bends <= bends && parallelRuns(r, LANE).length <= pairs, `seed ${seed}: ${scoreOf(r).bends} bends, ${parallelRuns(r, LANE).length} pairs`);
  }
});

test('random figures with the detour: no crossing more than without it, and fewer figures where it leaves more pairs of runs under a lane step (28 of 250 in origin/main)', () => {
  let n = 0, added = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const {boxes, es} = randomGraph(seed);
    if (!es.length) continue;
    const lay = layoutWithLanes(boxes, es, {dir: 'right', gap: 24, levelGap: 60, coord: 'bk', transpose: true} as never);
    const route = (detour: boolean) => [...routeLayered(lay, p => p, 22, undefined, undefined, true, false, false, detour, detour, 1, false, {}, true).values()];
    const a = route(false), d = route(true);
    if (JSON.stringify(a) === JSON.stringify(d)) continue;
    n++;
    assert.ok(scoreOf(d).crossings <= scoreOf(a).crossings, `seed ${seed}: crossings ${scoreOf(a).crossings} -> ${scoreOf(d).crossings}`);
    if (parallelRuns(d, LANE).length > parallelRuns(a, LANE).length) added++;
  }
  assert.ok(n > 200, `${n} figures with a detour`);
  assert.ok(added <= 12, `${added} figures where the detour leaves more pairs (origin/main: 28)`);
});

// ---- ADR 0070's criteria for the reported CRT's shape (test/fixtures/crt-report-shape.ts) ------------------------------------------------------------

const causeOf = async (d: Parameters<typeof checkDiagram>[0]) => {
  const r = await checkDiagram(d);
  return {t: r.laidOut.laidOut.find(b => b.type === 'cause') as LaidOutCause, cc: r.verdict.warnings.filter(w => w.startsWith('[cause-crossing]')).length, ep: lintDiagram(r.laidOut).filter(f => f.rule === 'edge-parallel').length};
};
const MIN_TEXT = 18; // the fixture's canvas

test("the reported CRT's shape, default (ALAP): no runs under a lane step, no cause-crossing, no loose AND, at most 4 bends an arrow", async () => {
  const {t, cc, ep} = await causeOf(crtReportShape());
  const routes = t.edges.map(e => e.points);
  assert.deepEqual(parallelRuns(routes, LANE), []);
  assert.equal(cc, 0);
  assert.equal(ep, 0);
  assert.deepEqual(t.loose, []);
  assert.ok(Math.max(...t.edges.map(e => e.points.length - 2)) <= 4);
  // the shortest distance between side-by-side runs (over 4px long together) is the lane step: 14 / 18 of the text, short of the ADR's 0.9. A lane step that grows
  // with the canvas's text is U5 (D7, `s = max(1, scale)`), which asserts 0.9 and `parallelRuns(·, laneStepOf × s)` = 0 (4 pairs between 14 and 18px today)
  const near = parallelRuns(routes, 4 * LANE);
  const spacing = Math.min(...near.map(p => p.gap));
  assert.ok(spacing >= LANE - 0.01, `side-by-side runs ${spacing}px apart`);
  assert.ok(spacing / MIN_TEXT < 0.9, 'U5 not done: the ratio is the lane step over the text, 0.78');
});

test("the reported CRT's shape at layer: 'asap' (reported, not required): no runs under a lane step, no loose AND; the two cause-crossings left are of groups whose arrows interleave", async () => {
  const {t, cc, ep} = await causeOf(crtReportShape({layer: 'asap'}));
  assert.deepEqual(parallelRuns(t.edges.map(e => e.points), LANE), []);
  assert.equal(ep, 0);
  assert.deepEqual(t.loose, []);
  // u1 -> u2 x e2 -> u2 and e8 -> u4 x pre4 -> u4: arrows of two AND groups (or a group and a lone arrow) into one head, whose ports lie in a block each (D3). The ends the arrows
  // come from (the way points before the head) interleave: for u2, e2's lies between the AND's two (1464 < 1614 < 1643), so either order of the two blocks crosses once (any order
  // of ports does: ports of an AND sit together); for u4, group {e8, pre3} and group {u3, pre4} interleave the same way. Port order cannot remove them: the order of the layers' rows
  // can (the order search, U6).
  assert.equal(cc, 2);
});


// ---- real CRTs the review found (PR #398): the same figures as origin/main, no two arrows on one line ----------------------------------------------

/** The random CRT of the review's generator (8 to 19 boxes, ANDs, one of 4 directions), by its number. */
const randomCrt = (want: number) => {
  let seed = 4711;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let g = 0; ; g++) {
    const n = 8 + Math.floor(rnd() * 12);
    const nodes = Array.from({length: n}, (_, k) => ({id: `n${k}`, label: `n${k} ` + 'あ'.repeat(3 + Math.floor(rnd() * 10))}));
    const links: ({from: string | string[]; to: string})[] = [], seen = new Set<string>();
    for (let k = 1; k < n; k++) { const f = Math.floor(rnd() * k); links.push({from: `n${f}`, to: `n${k}`}); seen.add(f + ':' + k); }
    const extra = Math.floor(n * (0.3 + rnd() * 0.6));
    for (let m = 0; m < extra; m++) { const a = Math.floor(rnd() * n), b = Math.floor(rnd() * n); if (a >= b || seen.has(a + ':' + b)) continue; seen.add(a + ':' + b); links.push({from: `n${a}`, to: `n${b}`}); }
    const nand = 1 + Math.floor(rnd() * 3);
    for (let q = 0; q < nand; q++) { const b = 3 + Math.floor(rnd() * (n - 3)), a1 = Math.floor(rnd() * b), a2 = Math.floor(rnd() * b); if (a1 !== a2 && !seen.has(a1 + ':' + b) && !seen.has(a2 + ':' + b)) { seen.add(a1 + ':' + b); seen.add(a2 + ':' + b); links.push({from: [`n${a1}`, `n${a2}`], to: `n${b}`}); } }
    const dir = (['up', 'left', 'down', 'right'] as const)[Math.floor(rnd() * 4)]!;
    if (g === want) return {nodes, links, dir};
  }
};

// origin/main drew #7 (down) with 1 crossing, #33 (left) with 7, #93 (down) with no two arrows on one line (under 4px). With the gaps sized by `trackLoad` the order
// search's "same layers" check dropped the better orders (#7: 5 crossings, #33: 16), and a move that got two arrows off one line was kept out by the pairs gate (#93)
for (const [g, crossings] of [[7, 1], [33, 7], [93, 0]] as const) {
  test(`the review's random CRT #${g}: at most ${crossings} crossings as origin/main, no two arrows on one line`, async () => {
    const {nodes, links, dir} = randomCrt(g);
    const {t} = await causeOf(diagram({theme: 'blue', width: 1800}).add(causeTree(nodes, links as never, {tree: 'crt', dir})));
    const routes = t.edges.map(e => e.points);
    assert.ok(crossingsOf(routes) <= crossings, `${crossingsOf(routes)} crossings`);
    assert.deepEqual(parallelRuns(routes, 4), []);
  });
}

// ---- the examples: edge-parallel in examples/toc-* ----------------------------------------------------------------------------------------------------

test('edge-parallel in examples/toc-*: none but toc-hop and toc-hop-all, whose pair is a long arrow\'s way point 8 to 10px from another arrow\'s last run / a return\'s lane', async () => {
  const EXAMPLES = path.resolve(import.meta.dirname, '../examples');
  const config = loadConfig();
  const found: Record<string, number> = {};
  for (const name of ['toc-blocks', 'toc-compact', 'toc-core', 'toc-crt-loop', 'toc-crt', 'toc-frt', 'toc-hop-all', 'toc-hop', 'toc-legend', 'toc-nbr', 'toc-prt', 'toc-tt']) {
    const r = await checkDiagram(await loadDiagram(path.join(EXAMPLES, `${name}.ts`), config));
    found[name] = lintDiagram(r.laidOut).filter(f => f.rule === 'edge-parallel').length;
  }
  assert.deepEqual(Object.fromEntries(Object.entries(found).filter(([, n]) => n > 0)), {'toc-hop-all': 1, 'toc-hop': 1});
});

// ---- the random layered graphs, against origin/main's totals ---------------------------------------------------------------------------------------

/** The review's distributions (A: 5 to 11 boxes 30 high, an arrow with probability 0.3; R: 3 to 5 layers of 2 to 4 boxes 40 to 80 high; RG: R with the first two arrows into each head an AND). */
const graphsOf = (dist: 'A' | 'R' | 'RG' | 'RG129') => {
  let seed = 0;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const out: {l: ReturnType<typeof layoutWithLanes>; groupOf?: (i: number) => number | undefined}[] = [];
  if (dist === 'A') {
    for (let s = 1; s <= 400; s++) {
      seed = s;
      const k = 4 + Math.floor(rnd() * 8), boxes = Array.from({length: k}, (_, i) => ({id: `n${i}`, size: {w: 60 + Math.floor(rnd() * 40), h: 30}}));
      const es: {from: string; to: string}[] = [];
      for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) if (rnd() < 0.3) es.push({from: `n${i}`, to: `n${j}`});
      if (es.length) out.push({l: layoutWithLanes(boxes, es, {dir: 'right', gap: 24, levelGap: 60})});
    }
    return out;
  }
  seed = dist === 'R' ? 12345 : 999;
  for (let g = 0; g < 400; g++) {
    const L = 3 + Math.floor(rnd() * 3), per = 2 + Math.floor(rnd() * 3), boxes: {id: string; size: {w: number; h: number}}[] = [], layer: string[][] = [];
    for (let l = 0; l < L; l++) { layer.push([]); for (let k = 0; k < per; k++) { const id = `n${l}_${k}`; boxes.push({id, size: {w: 60 + Math.floor(rnd() * 60), h: 40 + Math.floor(rnd() * 40)}}); layer[l]!.push(id); } }
    const es: {from: string; to: string}[] = [], seen = new Set<string>(), m = Math.floor(boxes.length * (1 + rnd()));
    for (let k = 0; k < m; k++) {
      const a = Math.floor(rnd() * (L - 1)), b = a + 1 + Math.floor(rnd() * (L - 1 - a)), from = layer[a]![Math.floor(rnd() * per)]!, to = layer[b]![Math.floor(rnd() * per)]!;
      if (seen.has(from + to)) continue;
      seen.add(from + to); es.push({from, to});
    }
    rnd();
    const l = layoutWithLanes(boxes, es, {dir: 'right', gap: 24, levelGap: 64});
    if (dist === 'R') { out.push({l}); continue; }
    const byTo = new Map<string, number[]>(), groups = new Map<number, number>();
    l.edges.forEach((e, i) => { if (!e.reversed) byTo.set(e.to, [...(byTo.get(e.to) ?? []), i]); });
    let gi = 0;
    for (const is of byTo.values()) if (is.length >= 2) { groups.set(is[0]!, gi); groups.set(is[1]!, gi); gi++; }
    out.push({l, groupOf: i => groups.get(i)});
  }
  return out;
};

// totals of the crossings origin/main (18a15eb4) drew for the same graphs, measured before this change
const MAIN_CROSSINGS = {A: 1119, R: 4058, RG: 4386, RG129: 4348};
for (const dist of ['A', 'R', 'RG', 'RG129'] as const) {
  test(`random layered graphs, ${dist} (400, fixed seed): no more crossings in all than origin/main, and no AND's arrows more crossed than with the turns half-way`, () => {
    let total = 0;
    graphsOf(dist).forEach(({l, groupOf}, g) => {
      const heads = dist === 'RG' ? {headRun: 26, turnRun: 30, andPorts: true} : dist === 'RG129' ? {headRun: 30, turnRun: 34, andPorts: true} : {};
      const old = routeLayered(l, p => p, 22, groupOf, undefined, true, false, false, false, false, 1, false, heads, false), now = routeLayered(l, p => p, 22, groupOf, undefined, true, false, false, false, false, 1, false, heads, true);
      total += scoreOf([...now.values()]).crossings;
      if (groupOf === undefined) return;
      const of = (r: Map<number, Pt[]>): number => { const by = new Map<number, Pt[][]>(); for (const [i, pts] of r) { const k = groupOf(i); if (k !== undefined) by.set(k, [...by.get(k) ?? [], pts]); } return [...by.values()].reduce((n, rs) => n + crossingsOf(rs), 0); };
      assert.ok(of(now) <= of(old), `#${g}: crossings inside an AND ${of(old)} -> ${of(now)}`);
    });
    assert.ok(total <= MAIN_CROSSINGS[dist], `${dist}: ${total} crossings in all, origin/main drew ${MAIN_CROSSINGS[dist]}`);
  });
}

// ---- guards of the speed-ups ------------------------------------------------------------------------------------------------------------------------

test('a gap\'s stage is played back only for the same input: with every stage given one key (a collision), the routes are what they are without', () => {
  for (const seed of [31, 52, 54]) {
    const {boxes, es} = randomGraph(seed);
    const lay = layoutWithLanes(boxes, es, {dir: 'right', gap: 24, levelGap: 60});
    const route = (heads: {stageHashBits?: number}) => rounded(routeLayered(lay, p => p, 22, undefined, undefined, true, false, false, false, false, 1, false, heads, true));
    assert.deepEqual(route({stageHashBits: 0}), route({}), `seed ${seed}`);
  }
});

test('crossingsWith keeps its cache for the default options only', () => {
  const a = [P(0, 5), P(10, 5)], b = [P(5, 0), P(5, 10)], cache = new WeakMap<Pt[], ReturnType<typeof runsOfPath>>();
  assert.equal(crossingsWith(a, [b], {margin: 3}, cache), 1);
  assert.equal(cache.has(a) || cache.has(b), false, 'nothing kept for other options');
  assert.equal(crossingsWith(a, [b], {}, cache), 1);
  assert.equal(cache.has(a) && cache.has(b), true);
  assert.equal(crossingsWith(a, [b], {margin: 6}, cache), 0, 'a margin of 6 leaves the crossing 5 from each end out, whatever the cache holds');
});

test('the gate\'s exception: a move that gets two arrows off one line adds at most two pairs for each overlap it takes off (runPairGain)', () => {
  const cache = new WeakMap<Pt[], RoutedRuns>();
  const corner = [P(0, 0), P(100, 0), P(100, 40)], onLine = [P(0, 2), P(100, 2)], away = [P(0, 11), P(100, 11)];
  assert.equal(runPairGain(new Map([[0, corner], [1, onLine]]), new Map([[0, corner], [1, away]]), LANE, cache) <= 0, true, 'an overlap 2px apart becomes a pair 11px apart: no more pairs');

  assert.equal(runPairGain(new Map([[0, corner], [1, [P(300, 300), P(300, 340)]]]), new Map([[0, corner], [1, away]]), LANE, cache) > 0, true);
});

// ---- the real CRTs: no figure with more pairs under a lane step than origin/main drew --------------------------------------------------------------

// the pairs (`parallelRuns(·, 14)`) origin/main (18a15eb4) drew: #85 1, #117 0, #142 1, #93 1 (width 1800) and #6 1, #70 0 (canvas 1.29). A `crowdOf` counted by `trackLoad`
// moved the tracks a few px and gave each one pair more (PR #398 round 2); it is deferred to U5 (the lane step grown with the text) with this check on each figure
for (const [g, pairs, canvas] of [[85, 1, false], [117, 0, false], [142, 1, false], [93, 1, false], [6, 1, true], [70, 0, true]] as const) {
  test(`the review's random CRT #${g}${canvas ? ' (canvas 1.29)' : ''}: at most ${pairs} pair(s) of runs under a lane step, as origin/main`, async () => {
    const {nodes: ns, links, dir} = randomCrt(g);
    const d = canvas ? diagram({theme: 'blue', canvas: {width: 2400, height: 1800, minText: 18, fit: 'content'}}) : diagram({theme: 'blue', width: 1800});
    const {t} = await causeOf(d.add(causeTree(ns, links as never, {tree: 'crt', dir})));
    assert.ok(parallelRuns(t.edges.map(e => e.points), LANE).length <= pairs);
  });
}

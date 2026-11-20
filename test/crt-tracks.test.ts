// ADR 0070 D4 (U4a): each turn of a long arrow across a gap gets a track of its own (`tracks`, a cause tree's own band only). The
// routing is checked on a layout of fixed box sizes (no font); the reported CRT's shape only for counts and for which runs lie on one line.
import test from 'node:test';
import './helpers/strict-width.ts'; // a label the layout did not register for measuring throws instead of measuring 0 wide
import assert from 'node:assert/strict';
import {laneStepOf, layoutWithLanes, routeLayered} from '../lib/layered-route.ts';
import {parallelRuns, scoreOf} from '../lib/polyline-metrics.ts';
import type {Pt} from '../lib/graph-layout.ts';
import {causeTree, checkDiagram, closeMeasurer, diagram} from '../lib/dsl.ts';
import type {Diagram} from '../lib/dsl.ts';
import type {LaidOutCause} from '../lib/types/diagrams.ts';
import {CRT_REPORT_LINKS, crtReportShape} from './fixtures/crt-report-shape.ts';

test.after(() => closeMeasurer());

// three long arrows (a2 -> c1, a3 -> c1, a3 -> c2) pass layer 1 beside m; half-way across gap 1 they turned on one line
const box = (id: string) => ({id, size: {w: 80, h: 60}});
const nodes = ['a1', 'a2', 'a3', 'm', 'c1', 'c2', 'c3'].map(box);
const edges = ([['a1', 'm'], ['m', 'c1'], ['m', 'c2'], ['m', 'c3'], ['a2', 'c1'], ['a3', 'c1'], ['a3', 'c2']] as const).map(([from, to]) => ({from, to}));
const lay = layoutWithLanes(nodes, edges, {dir: 'right', gap: 24, levelGap: 120});
const route = (tracks?: boolean): Map<number, Pt[]> => routeLayered(lay, p => p, 22, undefined, undefined, true, false, false, false, false, 1, false, {}, ...(tracks === undefined ? [] : [tracks]));
const LANE = laneStepOf();
/** The runs across the gaps (vertical here: the layers run along x), with the arrow each belongs to. */
const across = (m: Map<number, Pt[]>) => [...m].flatMap(([i, r]) => r.slice(1).flatMap((q, k) => {
  const p = r[k]!;
  return Math.abs(p.x - q.x) < 0.5 && Math.abs(p.y - q.y) >= 0.5 ? [{i, x: p.x, lo: Math.min(p.y, q.y), hi: Math.max(p.y, q.y)}] : [];
}));

test('without tracks (the default, every band but a cause tree\'s own) long arrows through one gap turn half-way, on one line', () => {
  const old = route();
  assert.deepEqual([...route(false)], [...old], '`tracks` left out is `tracks: false`');
  assert.ok(parallelRuns([...old.values()], LANE).some(p => p.gap < 0.5), 'the fixture of this test has the overlap U4a removes');
});

test('with tracks: the long arrows through one gap turn a lane step apart or more (no runs side by side under LANE), no worse in crossings or bends', () => {
  const old = route(false), now = route(true);
  assert.deepEqual(parallelRuns([...now.values()], LANE), []);
  const a = scoreOf([...old.values()]), b = scoreOf([...now.values()]);
  assert.ok(b.crossings <= a.crossings && b.bends <= a.bends, `${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
});

test('with tracks: two runs of different arrows on one track keep their ends a lane step apart or more', () => {
  const runs = across(route(true));
  for (const [k, r] of runs.entries()) for (const s of runs.slice(k + 1)) {
    if (r.i === s.i || Math.abs(r.x - s.x) >= 0.5) continue;
    assert.ok(Math.max(r.lo, s.lo) - Math.min(r.hi, s.hi) >= LANE, `arrows ${r.i} and ${s.i} on x = ${r.x}: ${r.lo}..${r.hi} and ${s.lo}..${s.hi}`);
  }
});

/** A layout of fixed box sizes (30 high) from the ids, widths and edges of one of the random layered graphs that found the faults. */
const shaped = (widths: [string, number][], es: [string, string][]) => layoutWithLanes(widths.map(([id, w]) => ({id, size: {w, h: 30}})), es.map(([from, to]) => ({from, to})), {dir: 'right', gap: 24, levelGap: 60});
const routeOf = (l: ReturnType<typeof layoutWithLanes>, tracks: boolean): Map<number, Pt[]> => routeLayered(l, p => p, 22, undefined, undefined, true, false, false, false, false, 1, false, {}, tracks);

test('with tracks: two long arrows whose spans end under a lane step apart do not share a track (the spans are made a lane step longer at both ends)', () => {
  // n0 -> n4 and n0 -> n8 turn in one gap with their spans 12px apart: without the extension they took one track, end to end
  const l = shaped([['n0', 80], ['n1', 68], ['n2', 61], ['n3', 94], ['n4', 75], ['n5', 86], ['n6', 90], ['n7', 63], ['n8', 96]], [['n0', 'n1'], ['n0', 'n4'], ['n0', 'n6'], ['n0', 'n8'], ['n1', 'n4'], ['n1', 'n8'], ['n3', 'n6'], ['n5', 'n6']]);
  const idx = (from: string, to: string): number => l.edges.findIndex(e => e.from === from && e.to === to);
  const a = idx('n0', 'n4'), b = idx('n0', 'n8');
  const runs = across(routeOf(l, true));
  const near = runs.filter(r => r.i === a).flatMap(r => runs.filter(s => s.i === b && Math.max(r.lo, s.lo) - Math.min(r.hi, s.hi) < LANE));
  assert.ok(near.length > 0, 'the two arrows have runs across one gap whose spans end under a lane step apart');
  for (const r of runs.filter(r => r.i === a)) for (const s of near) assert.ok(Math.abs(r.x - s.x) >= LANE || Math.max(r.lo, s.lo) - Math.min(r.hi, s.hi) >= LANE, `on one track: ${JSON.stringify([r, s])}`);
});

test('with tracks: a long arrow that turned on the line of a direct arrow\'s lane leaves it to the side that crosses nothing (no more crossings)', () => {
  // half-way, the last turn of a long arrow into n5 lay on the lane of a direct arrow; moving it always to the right added 2 crossings
  const l = shaped([['n0', 93], ['n1', 91], ['n2', 91], ['n3', 67], ['n4', 63], ['n5', 88], ['n6', 93]], [['n0', 'n2'], ['n0', 'n3'], ['n0', 'n5'], ['n0', 'n6'], ['n1', 'n2'], ['n1', 'n6'], ['n2', 'n5'], ['n3', 'n5'], ['n5', 'n6']]);
  const old = scoreOf([...routeOf(l, false).values()]), now = scoreOf([...routeOf(l, true).values()]);
  assert.ok(now.crossings <= old.crossings, `${old.crossings} -> ${now.crossings}`);
  const before = parallelRuns([...routeOf(l, false).values()], 4).length, after = parallelRuns([...routeOf(l, true).values()], 4).length;
  assert.ok(after <= before, `pairs on one line ${before} -> ${after}`);
});

test('with tracks: no random layered graph gets more crossings or bends than with its turns half-way (400 graphs, fixed seeds)', () => {
  let seed = 0;
  const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let s = 1; s <= 400; s++) {
    seed = s;
    const n = 4 + Math.floor(rng() * 8);
    const widths = Array.from({length: n}, (_, i): [string, number] => [`n${i}`, 60 + Math.floor(rng() * 40)]);
    const es: [string, string][] = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (rng() < 0.3) es.push([`n${i}`, `n${j}`]);
    if (!es.length) continue;
    const l = shaped(widths, es), old = scoreOf([...routeOf(l, false).values()]), now = scoreOf([...routeOf(l, true).values()]);
    assert.ok(now.crossings <= old.crossings && now.bends <= old.bends, `seed ${s}: ${JSON.stringify(old)} -> ${JSON.stringify(now)}`);
  }
});

/** The pairs of arrows with runs on one line (under 4px apart), once per pair: what the tracks may trade for a crossing (ADR 0070 D4). */
const onOneLine = (rs: Pt[][]): number => new Set(parallelRuns(rs, 4).map(p => `${p.a}:${p.b}`)).size;
/** The review's layered graphs (round 2): 3 to 5 layers of 2 to 4 boxes 40 to 80 high, edges between any two layers. */
const reviewGraphs = (count: number) => {
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  return Array.from({length: count}, () => {
    const L = 3 + Math.floor(rnd() * 3), per = 2 + Math.floor(rnd() * 3), boxes: {id: string; size: {w: number; h: number}}[] = [], layer: string[][] = [];
    for (let l = 0; l < L; l++) { layer.push([]); for (let k = 0; k < per; k++) { const id = `n${l}_${k}`; boxes.push({id, size: {w: 60 + Math.floor(rnd() * 60), h: 40 + Math.floor(rnd() * 40)}}); layer[l]!.push(id); } }
    const es: {from: string; to: string}[] = [], seen = new Set<string>();
    const m = Math.floor(boxes.length * (1 + rnd()));
    for (let k = 0; k < m; k++) {
      const a = Math.floor(rnd() * (L - 1)), b = a + 1 + Math.floor(rnd() * (L - 1 - a)), from = layer[a]![Math.floor(rnd() * per)]!, to = layer[b]![Math.floor(rnd() * per)]!;
      if (seen.has(from + to)) continue;
      seen.add(from + to); es.push({from, to});
    }
    return layoutWithLanes(boxes, es, {dir: 'right', gap: 24, levelGap: 64});
  });
};

test('the review\'s graphs #133 and #320: no more crossings with tracks (the fixed / spread routes are chosen by the placing\'s own measure)', () => {
  const graphs = reviewGraphs(321);
  for (const g of [133, 320]) {
    const old = scoreOf([...routeOf(graphs[g]!, false).values()]), now = scoreOf([...routeOf(graphs[g]!, true).values()]);
    assert.ok(now.crossings <= old.crossings && now.bends <= old.bends, `#${g}: ${JSON.stringify(old)} -> ${JSON.stringify(now)}`);
  }
});

test('the review\'s graphs (400, boxes 40 to 80 high): crossings + pairs on one line never grow; a crossing grows only where a pair on one line went (#35), bends only where crossings went', () => {
  const traded: number[] = [];
  reviewGraphs(400).forEach((l, g) => {
    const old = [...routeOf(l, false).values()], now = [...routeOf(l, true).values()];
    const a = scoreOf(old), b = scoreOf(now), la = onOneLine(old), lb = onOneLine(now);
    assert.ok(b.crossings + lb <= a.crossings + la, `#${g}: ${a.crossings} + ${la} -> ${b.crossings} + ${lb}`);
    if (b.crossings > a.crossings) { assert.ok(lb < la, `#${g}: a crossing more with no pair on one line less`); traded.push(g); }
    if (b.bends > a.bends) assert.ok(b.crossings < a.crossings, `#${g}: bends ${a.bends} -> ${b.bends} with no crossing less`);
  });
  assert.deepEqual(traded, [35], 'the one trade of pairs on one line for crossings (44 -> 46, 4 pairs on one line fewer)');
});

const laid = async (d: Diagram): Promise<{t: LaidOutCause; parallel: number; crossing: number}> => {
  const r = await checkDiagram(d);
  const count = (rule: string): number => r.verdict.findings.filter(f => f.rule === rule).length;
  return {t: r.laidOut.laidOut.find(b => b.type === 'cause') as LaidOutCause, parallel: count('edge-parallel'), crossing: count('cause-crossing')};
};
const bends = (t: LaidOutCause): number[] => t.edges.map(e => e.points.length - 2);

test("the reported CRT's shape, default (ALAP): no runs side by side, every AND drawn, no more bends than before the tracks (54, at most 4)", async () => {
  const {t, parallel, crossing} = await laid(crtReportShape());
  assert.equal(parallel, 0);
  assert.equal(crossing, 0);
  assert.deepEqual(parallelRuns(t.edges.map(e => e.points), LANE), []);
  assert.equal(t.ands.length, CRT_REPORT_LINKS.filter(l => typeof l.from !== 'string').length);
  assert.deepEqual(t.loose, []);
  assert.ok(bends(t).reduce((s, b) => s + b, 0) <= 54 && Math.max(...bends(t)) <= 4, `bends ${bends(t)}`);
});

test("the reported CRT's shape at layer 'asap': no two arrows on one line any more (the long arrows' half-way turns), no edge-parallel", async () => {
  const {t, parallel, crossing} = await laid(crtReportShape({layer: 'asap'}));
  const pairs = parallelRuns(t.edges.map(e => e.points), LANE);
  assert.deepEqual(pairs.filter(p => p.gap < 4), [], 'nothing left on one line (17 pairs, 0px apart at most, before the tracks)');
  // what is left is U4b's: two arrows into one head, side by side before it (their last turns, `lastTurn`)
  for (const p of pairs) assert.equal(t.edges[p.a]!.to, t.edges[p.b]!.to, `a pair that is not two arrows into one head: ${JSON.stringify(p)}`);
  assert.equal(parallel, 0);
  assert.equal(crossing, 0);
  assert.deepEqual(t.loose, []);
});

test('a random cause tree of the review (#80): the 0px overlap of two long arrows goes (traded for two bends), no crossing of an AND, no edge-parallel', async () => {
  const spec: [string, number][] = [['n0', 13], ['n1', 6], ['n2', 10], ['n3', 6], ['n4', 11], ['n5', 8], ['n6', 8], ['n7', 8], ['n8', 6], ['n9', 10], ['n10', 16]];
  const links = ([['n0', 'n1'], ['n0', 'n2'], ['n2', 'n3'], ['n1', 'n4'], ['n1', 'n5'], ['n0', 'n6'], ['n3', 'n7'], ['n2', 'n8'], ['n2', 'n9'], ['n7', 'n10'], ['n8', 'n9'], ['n6', 'n8'], ['n6', 'n7']] as const).map(([from, to]) => ({from, to}));
  const nodes = spec.map(([id, n]) => ({id, label: `${id} ${'あ'.repeat(n - id.length - 1)}`}));
  const {t, parallel, crossing} = await laid(diagram({theme: 'blue', width: 1800}).add(causeTree(nodes, links, {dir: 'up'})));
  assert.equal(onOneLine(t.edges.map(e => e.points)), 0, 'before the tracks n2 -> n9 and n6 -> n7 ran 47px on one line');
  assert.equal(parallel, 0);
  assert.equal(crossing, 0);
});

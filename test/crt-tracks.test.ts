// ADR 0070 D4 (U4a): each turn of a long arrow across a gap gets a track of its own (`tracks`, a cause tree's own band only). U4b: the
// turns of a gap take the order of the vertical constraints (no crossing where none is needed), the long arrows' last turns included.
// The routing is checked on a layout of fixed box sizes (no font); the reported CRT's shape only for counts and for which runs lie on one line.
import test from 'node:test';
import './helpers/strict-width.ts'; // a label the layout did not register for measuring throws instead of measuring 0 wide
import assert from 'node:assert/strict';
import {constrainedOrder, laneStepOf, layoutWithLanes, routeLayered} from '../lib/layered-route.ts';
import {crossingsOf, parallelRuns, scoreOf} from '../lib/polyline-metrics.ts';
import {lintDiagram} from '../lib/rules.ts';
import type {Pt} from '../lib/graph-layout.ts';
import {causeTree, checkDiagram, closeMeasurer, diagram} from '../lib/dsl.ts';
import type {Diagram} from '../lib/dsl.ts';
import type {LaidOutCause} from '../lib/types/diagrams.ts';
import {CRT_REPORT_LINKS, CRT_REPORT_NODES, CRT_REPORT_OPTIONS, crtReportShape} from './fixtures/crt-report-shape.ts';

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

test('the review\'s graphs (400, boxes 40 to 80 high): crossings + pairs on one line never grow; a crossing grows only where a pair on one line went (#35 at most), bends only where crossings went', () => {
  const traded: number[] = [];
  reviewGraphs(400).forEach((l, g) => {
    const old = [...routeOf(l, false).values()], now = [...routeOf(l, true).values()];
    const a = scoreOf(old), b = scoreOf(now), la = onOneLine(old), lb = onOneLine(now);
    assert.ok(b.crossings + lb <= a.crossings + la, `#${g}: ${a.crossings} + ${la} -> ${b.crossings} + ${lb}`);
    if (b.crossings > a.crossings) { assert.ok(lb < la, `#${g}: a crossing more with no pair on one line less`); traded.push(g); }
    if (b.bends > a.bends) assert.ok(b.crossings < a.crossings, `#${g}: bends ${a.bends} -> ${b.bends} with no crossing less`);
  });
  // U4a traded 4 pairs on one line for 2 crossings in #35 (44 -> 46); U4b's order of the gap's turns takes that crossing away again
  assert.ok(traded.every(g => g === 35), `trades of pairs on one line for crossings: ${traded}`);
});

// edge-parallel is a lint rule (checkDiagram's findings carry it only for a doc's figure) and cause-crossing a warning of the verifier
const laid = async (d: Diagram): Promise<{t: LaidOutCause; parallel: number; crossing: number}> => {
  const r = await checkDiagram(d);
  return {t: r.laidOut.laidOut.find(b => b.type === 'cause') as LaidOutCause, parallel: lintDiagram(r.laidOut).filter(f => f.rule === 'edge-parallel').length, crossing: r.verdict.warnings.filter(w => w.startsWith('[cause-crossing]')).length};
};
/** The crossings of the arrows of one AND with each other, for every AND of the band. */
const inAnd = (t: LaidOutCause): number[] => t.ands.map(a => crossingsOf(t.edges.filter(e => e.to === a.to && a.from.includes(e.from)).map(e => e.points)));
const bends = (t: LaidOutCause): number[] => t.edges.map(e => e.points.length - 2);

test("the reported CRT's shape, default (ALAP): no runs side by side, every AND drawn, no arrows into an AND crossing, at most 4 bends an arrow", async () => {
  const {t, parallel, crossing} = await laid(crtReportShape());
  assert.equal(parallel, 0);
  assert.equal(crossing, 0, 'before U4b: pre1 -> e2 x r1 -> e2 and u3 -> u4 x pre4 -> u4 (the ADR\'s e2 and u4)');
  assert.deepEqual(inAnd(t), t.ands.map(() => 0));
  assert.deepEqual(parallelRuns(t.edges.map(e => e.points), LANE), []);
  assert.equal(t.ands.length, CRT_REPORT_LINKS.filter(l => typeof l.from !== 'string').length);
  assert.deepEqual(t.loose, []);
  // 54 before U4b; the order search now finds a figure of 5 crossings (11 before) with 2 bends more, and takes it (crossings come first)
  assert.ok(bends(t).reduce((s, b) => s + b, 0) <= 56 && Math.max(...bends(t)) <= 4, `bends ${bends(t)}`);
});

test("the reported CRT's shape at layer 'asap': no two arrows on one line any more (the long arrows' half-way turns), no edge-parallel", async () => {
  const {t, parallel, crossing} = await laid(crtReportShape({layer: 'asap'}));
  const pairs = parallelRuns(t.edges.map(e => e.points), LANE);
  assert.deepEqual(pairs.filter(p => p.gap < 4), [], 'nothing left on one line (17 pairs, 0px apart at most, before the tracks)');
  // what is left is U4b's: two arrows into one head, side by side before it (their last turns, `lastTurn`)
  for (const p of pairs) assert.equal(t.edges[p.a]!.to, t.edges[p.b]!.to, `a pair that is not two arrows into one head: ${JSON.stringify(p)}`);
  assert.equal(parallel, 0);
  // no two arrows of one AND cross. Two cause-crossing warnings are left (u1 -> u2 x e2 -> u2, e8 -> u4 x pre4 -> u4, as before U4b): each
  // pair is of arrows of two groups into one head whose runs ask for both orders across the gap (the ports and the way points decide them)
  assert.deepEqual(inAnd(t), t.ands.map(() => 0));
  assert.ok(crossing <= 2, `cause-crossing ${crossing}`);
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

// ---- U4b: the order of the turns of a gap (the vertical constraints) -------------------------------------------------------------------

test('constrainedOrder: a run along the layers within the span of another turn puts that turn on its far side; free pairs keep the rank', () => {
  const ord = (legs: [number, number][], rank = legs.map((_l, k) => k)): number[] => constrainedOrder(legs.map((_l, k) => k), k => ({left: legs[k]![0], right: legs[k]![1]}), k => rank[k]!);
  // fan-out from one tail, going down: the one that goes farther turns first (its right run is below the other's span)
  assert.deepEqual(ord([[10, 40], [20, 100]]), [1, 0]);
  // fan-in to one head, going down: the tail nearer the head turns first
  assert.deepEqual(ord([[0, 90], [60, 100]]), [1, 0]);
  // the ADR's u4 (across positions of the review's routes, tail side first): u3 -> u4 (1260 -> 769) turned before pre4 -> u4 (990 -> 747)
  // and its run across crossed pre4's run at 990; pre4 has to turn first
  assert.deepEqual(ord([[1260, 769], [990, 747]], [0, 1]), [1, 0]);
  // apart: the rank decides
  assert.deepEqual(ord([[0, 10], [50, 60]], [1, 0]), [1, 0]);
  // a pair that crosses whichever way (one span inside the other with its runs on both sides) keeps the rank
  assert.deepEqual(ord([[0, 100], [40, 60]], [0, 1]), [0, 1]);
  assert.deepEqual(ord([[0, 100], [40, 60]], [1, 0]), [1, 0]);
  // three turns that ask for an order among themselves (1 within 0's span: 1 before 0; the other two pairs ask both ways, so they are free):
  // the one constraint holds, and the order is complete (a loop of constraints is closed by leaving out the last by rank, never by dropping a turn)
  const three = ord([[0, 20], [10, 30], [25, 5]]);
  assert.deepEqual([...three].sort(), [0, 1, 2]);
  assert.ok(three.indexOf(1) < three.indexOf(0), `${three}`);
});

/** The fixed-size layered layout of a cause tree's routes: AND arrows (`and`, by edge index) into one head, the room before a head of D8. */
const andRoutes = (boxes: [string, number, number][], es: [string, string][], and: number[], tracks: boolean) => {
  const l = layoutWithLanes(boxes.map(([id, w, h]) => ({id, size: {w, h}})), es.map(([from, to]) => ({from, to})), {dir: 'right', gap: 28, levelGap: 64});
  const group = new Set(and);
  const routes = routeLayered(l, p => p, 22, i => group.has(l.edges[i]!.index) ? 0 : undefined, undefined, true, false, false, false, false, 1, false, {headRun: 26, turnRun: 30, andPorts: true}, tracks);
  return {l, routes, and: [...routes].filter(([i]) => group.has(l.edges[i]!.index)).map(([, r]) => r)};
};

test("U4b, the ADR's u4: the two direct arrows of an AND in a gap with arrows into other heads do not cross (they did with the fan-out order)", () => {
  const boxes: [string, number, number][] = [['n00', 40, 180], ['n01', 60, 140], ['n10', 60, 100], ['n11', 50, 140], ['n20', 50, 180], ['n21', 60, 180]];
  const es: [string, string][] = [['n01', 'n20'], ['n00', 'n10'], ['n00', 'n20'], ['n00', 'n11'], ['n01', 'n10']];
  const old = andRoutes(boxes, es, [0, 2], false), now = andRoutes(boxes, es, [0, 2], true);
  assert.ok(old.and.every(r => r.length === 4) && new Set(old.l.edges.map(e => e.to)).size > 1, 'two direct arrows, and the gap has arrows into other heads');
  assert.equal(crossingsOf(old.and), 2, 'without tracks (the old lane order) the AND\'s arrows cross');
  assert.equal(crossingsOf(now.and), 0);
  const a = scoreOf([...old.routes.values()]), b = scoreOf([...now.routes.values()]);
  assert.ok(b.crossings < a.crossings && b.bends <= a.bends, `${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
});

test("U4b, the ADR's e2: a long arrow and a direct arrow into one AND do not cross; the long one's last turn is a track on the tail side, headRun from the head", () => {
  const boxes: [string, number, number][] = [['n00', 60, 100], ['n01', 50, 180], ['n10', 50, 100], ['n11', 60, 180], ['n20', 60, 140], ['n21', 60, 100]];
  const es: [string, string][] = [['n10', 'n21'], ['n00', 'n21'], ['n00', 'n10'], ['n10', 'n20'], ['n01', 'n11']];
  const old = andRoutes(boxes, es, [0, 1], false), now = andRoutes(boxes, es, [0, 1], true);
  const [direct, long] = now.and as [Pt[], Pt[]];
  assert.ok(direct.length === 4 && long.length === 6, 'a direct arrow and a long one');
  assert.ok(crossingsOf(old.and) > 0, 'without tracks (the long arrow\'s last turn a fixed distance before the head) they cross');
  assert.equal(crossingsOf(now.and), 0);
  const last = long[3]!.x, turn = direct[1]!.x, head = long[5]!.x;
  assert.ok(turn - last >= LANE, `the long arrow's last turn ${last} on the tail side of the direct one's ${turn}, a lane step apart`);
  assert.ok(head - last >= 26, `its last run ${head - last} keeps the AND's arc (headRun)`);
  assert.equal(parallelRuns(now.and, LANE).length, 0);
});

test("U4b, the reported CRT's u4 in a smaller figure: the two ANDs into u4 and the arrows into e1 through one gap, no AND arrows crossing", async () => {
  const links = CRT_REPORT_LINKS.filter(l => l.to === 'u4' || l.to === 'e1');
  const used = new Set(links.flatMap(l => [l.to, ...(typeof l.from === 'string' ? [l.from] : l.from)]));
  const nodes = CRT_REPORT_NODES.filter(n => used.has(n.id));
  const {t, crossing} = await laid(diagram({theme: 'blue', canvas: {width: 2600, height: 2000, minText: 18, fit: 'content'}}).add(causeTree(nodes, links, CRT_REPORT_OPTIONS)));
  assert.equal(crossing, 0);
  assert.deepEqual(inAnd(t), [0, 0, 0]);
  assert.deepEqual(t.loose, []);
});

test('U4b m1: the direct arrows\' lanes take the order of the vertical constraints where the old order crosses (a fixed graph: 3 crossings, 7 with the lanes in the old order)', () => {
  const l = shaped([['n0', 99], ['n1', 87], ['n2', 96], ['n3', 81], ['n4', 68], ['n5', 95], ['n6', 77]], [['n0', 'n2'], ['n0', 'n5'], ['n0', 'n6'], ['n1', 'n2'], ['n1', 'n6'], ['n2', 'n4'], ['n3', 'n5'], ['n5', 'n6']]);
  const now = scoreOf([...routeOf(l, true).values()]);
  // forcing the lanes back to the old order (assignLanes with no constrainedOrder) draws 7 crossings with 20 bends
  assert.ok(now.crossings <= 3, JSON.stringify(now));
});

// ADR 0070 D4 (U4b), the review's round 1 (M1): with `tracks` a long arrow's last turn into an AND was placed from half-way across its gap and
// squeezed in a narrow one. The routes are judged against where it turned before (`lastTurn`), so no figure gets a crossing more than it had.
/** A layered graph of fixed boxes (id, w, h), the arrows `es`, the first two arrows into every head with two or more being one AND (the review's RG distribution). */
const andGraph = (boxes: [string, number, number][], es: [string, string][], scale: number) => {
  const l = layoutWithLanes(boxes.map(([id, w, h]) => ({id, size: {w, h}})), es.map(([from, to]) => ({from, to})), {dir: 'right', gap: 24, levelGap: 64});
  const byTo = new Map<string, number[]>();
  l.edges.forEach((e, i) => { if (!e.reversed) byTo.set(e.to, [...(byTo.get(e.to) ?? []), i]); });
  const groupOf = new Map<number, number>();
  let gi = 0;
  for (const is of byTo.values()) if (is.length >= 2) { groupOf.set(is[0]!, gi); groupOf.set(is[1]!, gi); gi++; }
  const heads = scale === 1 ? {headRun: 26, turnRun: 30, andPorts: true} : {headRun: 30, turnRun: 34, andPorts: true};
  const at = (tracks: boolean) => routeLayered(l, p => p, 22, i => groupOf.get(i), undefined, true, false, false, false, false, 1, false, heads, tracks);
  const lastRun = (r: Map<number, Pt[]>): number => Math.min(...[...groupOf.keys()].map(i => { const p = r.get(i)!; return Math.abs(p.at(-1)!.x - p.at(-2)!.x) + Math.abs(p.at(-1)!.y - p.at(-2)!.y); }));
  const andPairs = (r: Map<number, Pt[]>): number => [...new Set(groupOf.values())].reduce((n, g) => n + crossingsOf([...groupOf].filter(([, k]) => k === g).map(([i]) => r.get(i)!)), 0);
  return {l, at, lastRun, andPairs, headRun: heads.headRun};
};

test("U4b M1, the review's RG #8 in fixed boxes: a long arrow's last turn into an AND stays where main put it, so the AND's two arrows do not cross", () => {
  const boxes: [string, number, number][] = [['n0_0', 83, 77], ['n0_1', 86, 77], ['n0_2', 64, 54], ['n1_0', 83, 69], ['n1_1', 100, 73], ['n1_2', 97, 52], ['n2_0', 87, 69], ['n2_1', 68, 59], ['n2_2', 92, 73], ['n3_0', 112, 65], ['n3_1', 63, 41], ['n3_2', 76, 74], ['n4_0', 97, 66], ['n4_1', 114, 52], ['n4_2', 93, 67]];
  const es: [string, string][] = [['n1_1', 'n2_2'], ['n3_2', 'n4_0'], ['n2_2', 'n4_0'], ['n0_0', 'n1_2'], ['n1_2', 'n3_0'], ['n3_1', 'n4_1'], ['n1_2', 'n2_0'], ['n3_1', 'n4_2'], ['n0_1', 'n1_1'], ['n3_2', 'n4_1'], ['n3_1', 'n4_0'], ['n1_1', 'n4_1'], ['n1_1', 'n3_2'], ['n3_0', 'n4_0'], ['n0_1', 'n3_1'], ['n3_0', 'n4_1']];
  const g = andGraph(boxes, es, 1), now = g.at(true);
  assert.equal(g.andPairs(now), 0, 'no crossing inside an AND');
  assert.ok(g.lastRun(now) >= g.headRun, `the last runs into the ANDs keep the arc: ${g.lastRun(now)}`);
  // main (U4a) drew this figure with 12 crossings and 36 bends; the first U4b drew 14 (the long arrow turned at 547, not 592, and crossed the direct one twice)
  const s = scoreOf([...now.values()]);
  assert.ok(s.crossings <= 12 && s.bends <= 36, JSON.stringify(s));
});

for (const scale of [1, 1.29]) {
  test(`U4b M1, random layered graphs with ANDs at scale ${scale} (400, fixed seed): no more crossings than with the turns half-way, none more inside an AND, the last runs keep headRun`, () => {
    let seed = 999;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let n = 0; n < 400; n++) {
      const L = 3 + Math.floor(rnd() * 3), per = 2 + Math.floor(rnd() * 3), boxes: [string, number, number][] = [], layer: string[][] = [];
      for (let l = 0; l < L; l++) { layer.push([]); for (let k = 0; k < per; k++) { const id = `n${l}_${k}`; boxes.push([id, 60 + Math.floor(rnd() * 60), 40 + Math.floor(rnd() * 40)]); layer[l]!.push(id); } }
      const es: [string, string][] = [], seen = new Set<string>(), m = Math.floor(boxes.length * (1 + rnd()));
      for (let k = 0; k < m; k++) {
        const a = Math.floor(rnd() * (L - 1)), b = a + 1 + Math.floor(rnd() * (L - 1 - a)), from = layer[a]![Math.floor(rnd() * per)]!, to = layer[b]![Math.floor(rnd() * per)]!;
        if (seen.has(from + to)) continue;
        seen.add(from + to); es.push([from, to]);
      }
      rnd();
      const g = andGraph(boxes, es, scale), old = g.at(false), now = g.at(true), a = scoreOf([...old.values()]), b = scoreOf([...now.values()]);
      assert.ok(b.crossings <= a.crossings, `#${n}: crossings ${a.crossings} -> ${b.crossings}`);
      assert.ok(g.andPairs(now) <= g.andPairs(old), `#${n}: crossings inside an AND ${g.andPairs(old)} -> ${g.andPairs(now)}`);
      assert.ok(g.lastRun(now) >= g.headRun, `#${n}: the last run into an AND ${g.lastRun(now)} < ${g.headRun}`);
    }
  });
}

// The order search (toc.ts) picks its figure by (crossings among the arrows into an AND's head, ..., crossings, bends) and its path differs with the routes it
// is given: main drew these two with 15 and 3 crossings. The arrows into one AND's head that cross each other are the search's to settle (U6); the totals do not grow.
test("U4b M1, the review's random CRTs #48 and #70: the crossings and `cause-crossing` warnings of this PR's figures (main drew 15 and 3 crossings)", async () => {
  const cases = [
    {limit: 9, cc: 1, dir: 'up' as const, nodes: [{id: 'n0', label: 'n0 ああああああああ'}, {id: 'n1', label: 'n1 ああああああああ'}, {id: 'n2', label: 'n2 ああああああああああ'}, {id: 'n3', label: 'n3 ああああああ'}, {id: 'n4', label: 'n4 あああああああああああ'}, {id: 'n5', label: 'n5 あああああああああ'}, {id: 'n6', label: 'n6 あああああああああ'}, {id: 'n7', label: 'n7 ああああああああああ'}, {id: 'n8', label: 'n8 あああああ'}, {id: 'n9', label: 'n9 あああああああああ'}, {id: 'n10', label: 'n10 あああああ'}, {id: 'n11', label: 'n11 ああああああ'}, {id: 'n12', label: 'n12 あああああああああ'}, {id: 'n13', label: 'n13 ああああ'}, {id: 'n14', label: 'n14 あああああ'}], links: [{from: 'n0', to: 'n1'}, {from: 'n1', to: 'n2'}, {from: 'n2', to: 'n3'}, {from: 'n2', to: 'n4'}, {from: 'n4', to: 'n5'}, {from: 'n4', to: 'n6'}, {from: 'n6', to: 'n7'}, {from: 'n0', to: 'n8'}, {from: 'n0', to: 'n9'}, {from: 'n6', to: 'n10'}, {from: 'n2', to: 'n11'}, {from: 'n3', to: 'n12'}, {from: 'n3', to: 'n13'}, {from: 'n9', to: 'n14'}, {from: 'n10', to: 'n11'}, {from: 'n13', to: 'n14'}, {from: 'n7', to: 'n12'}, {from: 'n6', to: 'n8'}, {from: 'n8', to: 'n9'}, {from: ['n3', 'n1'], to: 'n5'}, {from: ['n0', 'n4'], to: 'n7'}]},
    {limit: 3, cc: 3, dir: 'left' as const, nodes: [{id: 'n0', label: 'n0 ああああああああ'}, {id: 'n1', label: 'n1 あああああ'}, {id: 'n2', label: 'n2 あああああ'}, {id: 'n3', label: 'n3 あああああ'}, {id: 'n4', label: 'n4 あああ'}, {id: 'n5', label: 'n5 あああああああ'}, {id: 'n6', label: 'n6 ああああああああああああ'}, {id: 'n7', label: 'n7 あああああああああ'}], links: [{from: 'n0', to: 'n1'}, {from: 'n1', to: 'n2'}, {from: 'n1', to: 'n3'}, {from: 'n0', to: 'n4'}, {from: 'n0', to: 'n5'}, {from: 'n3', to: 'n6'}, {from: 'n2', to: 'n7'}, {from: 'n5', to: 'n6'}, {from: 'n4', to: 'n6'}, {from: ['n0', 'n2'], to: 'n6'}]},
  ];
  for (const {limit, cc, dir, nodes: ns, links} of cases) {
    const {t, crossing} = await laid(diagram({theme: 'blue', width: 1800}).add(causeTree(ns, links as never, {tree: 'crt', dir})));
    const c = crossingsOf(t.edges.map(e => e.points));
    assert.ok(c <= limit, `${dir}: ${c} crossings, this PR drew ${limit}`);
    // #70's 3 are a known limit (main: 0): the order search's height filter drops the layout without them (282 > 262.5px), see ADR 0070 U6 and Issue #397
    assert.ok(crossing <= cc, `${dir}: ${crossing} cause-crossing warnings, this PR drew ${cc}`);
  }
});

// ADR 0073 D3 (U3): the tail of an arrow into an AND's head is moved onto the head's height, so the step (the jog) between the two ports goes. The head's ports and the arc do not change.
// One test per rule of D3 (`align(i, tailOnly)` and its call in `routeOnce`); the layouts are fixed boxes, so nothing here depends on a font. The figures are drawn with the rule on (`tailAlign` unset)
// and off (`tailAlign: false`, the way the order search judges, and the way main drew): a rule is seen as the difference between them.
import test from 'node:test';
import {register} from 'node:module';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {checkDiagram, closeMeasurer} from '../lib/dsl.ts';
import type {Diagram} from '../lib/dsl.ts';
import {layoutWithLanes, routeLayered, tailMoveKept} from '../lib/layered-route.ts';
import {bendsOf, crossingsOf, scoreOf} from '../lib/polyline-metrics.ts';
import type {Pt} from '../lib/graph-layout.ts';
import type {LayeredLayout} from '../lib/graph-layout.ts';
import type {LaidOutCause} from '../lib/types/diagrams.ts';
import {loadDiagram} from '../lib/load-source.ts';
import {andArc} from '../lib/toc.ts';
import {crtReportShape} from './fixtures/crt-report-shape.ts';

register(new URL('../lib/resolve-hook.ts', import.meta.url)); // the examples import 'svg-diagram'
test.after(() => closeMeasurer());

type Box = [id: string, w: number, h: number];
interface Opts {y?: Record<string, number>; straighten?: boolean; round?: (id: string) => boolean; andPorts?: boolean; tracks?: boolean; groupOf?: (index: number) => number | undefined; outer?: number[]; back?: number[]}
/** Fixed boxes, the layers along x (dir 'right'), the arrows `and` (by index) one AND group into one head. `y` moves boxes after the layout (a hand-made placement). Returns the routes by 'from>to', the rule on and off. */
function fig(boxes: Box[], es: [string, string][], and: number[], o: Opts = {}) {
  const lay: LayeredLayout = layoutWithLanes(boxes.map(([id, w, h]) => ({id, size: {w, h}})), es.map(([from, to]) => ({from, to})), {dir: 'right', gap: 28, levelGap: 64, ...(o.outer ? {outer: {which: 'all' as const, gap: 14, step: 14}, back: o.back ?? o.outer} : {})});
  for (const [id, y] of Object.entries(o.y ?? {})) lay.nodes.get(id)!.y = y;
  const group = new Set(and);
  const groupOf = o.groupOf ?? ((index: number) => group.has(index) ? 0 : undefined);
  const draw = (tailAlign: boolean): Map<string, Pt[]> => {
    const routes = routeLayered(lay, p => p, 22, i => groupOf(lay.edges[i]!.index), o.round, o.straighten ?? true, false, false, false, false, 1, false, {headRun: 26, turnRun: 30, ...(o.andPorts === false ? {} : {andPorts: true}), tailAlign}, o.tracks ?? true);
    return new Map([...routes].map(([i, p]) => [`${lay.edges[i]!.from}>${lay.edges[i]!.to}`, p]));
  };
  return {lay, on: draw(true), off: draw(false)};
}
const straight = (p: Pt[]): boolean => p.length === 2 && p[0]!.y === p[1]!.y;
const tip = (p: Pt[]): Pt => p.at(-1)!;
/** The same heights (a route's across coordinates may move when the lanes spread again; what the rule moves is the ports' heights). */
const same = (a: Pt[], b: Pt[]): boolean => JSON.stringify(a.map(p => p.y)) === JSON.stringify(b.map(p => p.y));

// a is tall, so the height of the head's port (a>h's) is inside a; b is short, so it is not inside b
const AB: Box[] = [['a', 60, 200], ['b', 60, 60], ['h', 60, 100]];
const AB_ES: [string, string][] = [['a', 'h'], ['b', 'h']];

test('D3 rules 1・2: the tail of an arrow into an AND goes onto the head port\'s height (a straight line); the head port, and the other AND arrow\'s head, stay', () => {
  const {on, off} = fig(AB, AB_ES, [0, 1]);
  assert.ok(!straight(off.get('a>h')!), 'before: an elbow with a jog');
  assert.equal(bendsOf(off.get('a>h')!), 2);
  assert.ok(straight(on.get('a>h')!), 'after: straight');
  assert.equal(bendsOf(on.get('a>h')!), 0);
  assert.equal(on.get('a>h')![0]!.y, tip(off.get('a>h')!).y, 'the tail is at the height of the head port as it was');
  for (const k of ['a>h', 'b>h']) assert.deepEqual(tip(on.get(k)!), tip(off.get(k)!), `${k}: the head port does not move`);
});

test('D3 rule 1: an arrow in no AND is not moved (the same figure, no group); nor a round end, nor straighten: false, nor a band without AND ports', () => {
  const none = fig(AB, AB_ES, [], {}), plain = fig(AB, AB_ES, [0, 1], {groupOf: () => undefined});
  for (const f of [none, plain]) assert.ok(same(f.on.get('a>h')!, f.off.get('a>h')!), 'no AND: the elbow stays');
  const round = fig(AB, AB_ES, [0, 1], {round: id => id === 'a'});
  assert.ok(same(round.on.get('a>h')!, round.off.get('a>h')!), 'a round tail: the elbow stays');
  const roundHead = fig(AB, AB_ES, [0, 1], {round: id => id === 'h'});
  assert.ok(same(roundHead.on.get('a>h')!, roundHead.off.get('a>h')!), 'a round head: the elbow stays');
  const kept = fig(AB, AB_ES, [0, 1], {straighten: false});
  assert.ok(same(kept.on.get('a>h')!, kept.off.get('a>h')!) && !straight(kept.on.get('a>h')!), 'straighten: false: the old figure');
  const pdpc = fig(AB, AB_ES, [0, 1], {andPorts: false});
  assert.ok(same(pdpc.on.get('a>h')!, pdpc.off.get('a>h')!), 'not a cause tree\'s own band (no `andPorts`): untouched');
});

test('D3 rule 1: a lone arrow in no AND keeps its jog (the old rule leaves a lone port), the same arrow in an AND is straightened', () => {
  const boxes: Box[] = [['a', 60, 400], ['h', 60, 100]], es: [string, string][] = [['a', 'h']], y = {a: 0, h: 200 + 28 - 50};
  const plain = fig(boxes, es, [], {y}), and = fig(boxes, es, [0], {y});
  assert.ok(!straight(plain.on.get('a>h')!) && same(plain.on.get('a>h')!, plain.off.get('a>h')!), 'no AND: the jog stays');
  assert.ok(straight(and.on.get('a>h')!), 'in an AND: straight');
});

test('D3 rule 1: an arrow that passes a layer (way points), a self-loop and a return around the outside are not moved', () => {
  // a -> m -> h, and a -> h in the AND (it passes m's layer: more than two points)
  const long = fig([['a', 60, 200], ['m', 60, 60], ['b', 60, 60], ['h', 60, 100]], [['a', 'm'], ['m', 'h'], ['a', 'h'], ['b', 'h']], [2, 3]);
  assert.ok(long.on.get('a>h')!.length > 2, 'a long arrow');
  assert.ok(same(long.on.get('a>h')!, long.off.get('a>h')!));
  const loop = fig([['a', 60, 200], ['b', 60, 60], ['h', 60, 100]], [['a', 'h'], ['b', 'h'], ['a', 'a']], [0, 1, 2]);
  assert.ok(loop.lay.edges.some(e => e.self), 'a self-loop in the group');
  assert.ok(straight(loop.on.get('a>h')!), 'the other arrow of the group is still moved');
  assert.deepEqual([...loop.on.keys()].sort(), [...loop.off.keys()].sort());
  // h -> a closes a cycle: with `outer` it is a return in the lane around the boxes
  const back = fig([['a', 60, 200], ['m', 60, 60], ['h', 60, 100]], [['a', 'm'], ['m', 'h'], ['h', 'a']], [0, 1, 2], {outer: [2], back: [2]});
  assert.ok(back.lay.edges.some(e => e.outer), 'an outer return');
  assert.ok(same(back.on.get('h>a')!, back.off.get('h>a')!));
});

test('D3 rule 3: the head port\'s height must be inside the tail\'s box, 6px from its edges: otherwise the arrow stays an elbow (the target is not clamped)', () => {
  const {on, off, lay} = fig(AB, AB_ES, [0, 1]);
  const head = tip(off.get('b>h')!).y, b = lay.nodes.get('b')!;
  assert.ok(head < b.y, `b>h's head port (${head}) is above b (${b.y})`);
  assert.ok(same(on.get('b>h')!, off.get('b>h')!), 'outside the box: no move, and no move to the nearest height either');
  // the same arrow with b under the target: 6px inside the edge moves, within 6px of the edge does not
  const inside = fig(AB, AB_ES, [0, 1], {y: {b: head - 12}}), edge = fig(AB, AB_ES, [0, 1], {y: {b: head - 3}});
  const h2 = (f: ReturnType<typeof fig>): number => tip(f.off.get('b>h')!).y;
  assert.ok(h2(inside) >= inside.lay.nodes.get('b')!.y + 6 && straight(inside.on.get('b>h')!), '12px inside the box: straight');
  assert.ok(h2(edge) < edge.lay.nodes.get('b')!.y + 6 && h2(edge) >= edge.lay.nodes.get('b')!.y && !straight(edge.on.get('b>h')!), 'inside the box but within 6px of its edge: an elbow');
});

test('D3 rule 4: the other ports on the tail\'s side keep their order and step: a move that would pass a neighbour\'s port is not made', () => {
  // a has a second arrow (a>k): its port is above a>h's. The target below it: moved. The target above it (the order would swap): not moved.
  const boxes: Box[] = [['a', 60, 200], ['b', 60, 60], ['h', 60, 100], ['k', 60, 60]], es: [string, string][] = [['a', 'h'], ['b', 'h'], ['a', 'k']];
  const below = fig(boxes, es, [0, 1], {y: {a: 0, b: 228, h: 129, k: 60}});
  assert.ok(straight(below.on.get('a>h')!), 'the target is after a>k\'s port: moved');
  assert.ok(below.on.get('a>h')![0]!.y - below.on.get('a>k')![0]!.y >= 14, 'a step from the neighbour');
  const above = fig(boxes, es, [0, 1], {y: {a: 0, b: 228, h: 20, k: 150}});
  const k = above.on.get('a>k')![0]!.y, target = tip(above.off.get('a>h')!).y;
  assert.ok(target < k, `the target ${target} is before a>k's port ${k}`);
  assert.ok(same(above.on.get('a>h')!, above.off.get('a>h')!), 'the elbow stays');
  assert.ok(same(above.on.get('a>k')!, above.off.get('a>k')!), 'the neighbour does not move');
});

test('D3 rule 5: another arrow\'s port of the same two layers within 3px of the target blocks the move (their runs would line up); 4px away does not', () => {
  const boxes: Box[] = [['a', 60, 200], ['b', 60, 60], ['h', 60, 100], ['k', 20, 20]], es: [string, string][] = [['a', 'h'], ['b', 'h'], ['a', 'k']];
  const at = (dy: number) => { const f = fig(boxes, es, [0, 1], {y: {a: 0, b: 228, h: 129, k: 179 + dy - 10}}); return {f, target: tip(f.off.get('a>h')!).y, kPort: tip(f.off.get('a>k')!).y}; };
  for (const dy of [-2, 0, 2]) {
    const {f, target, kPort} = at(dy);
    assert.ok(Math.abs(kPort - target) < 3, `k's port is ${kPort - target}px from the target`);
    assert.ok(same(f.on.get('a>h')!, f.off.get('a>h')!), `${dy}px: not moved`);
  }
  for (const dy of [-4, 4]) {
    const {f, target, kPort} = at(dy);
    assert.equal(Math.abs(kPort - target), 4);
    assert.ok(straight(f.on.get('a>h')!), `${dy}px: moved`);
  }
});

test('D3 rule 6: a moved tail is kept only when (crossings, bends) are strictly better, it is not along another run, adds no pair of runs, and adds no crossing among the AND\'s arrows', () => {
  const b = {crossings: 2, bends: 4}, ok = () => false, never = (): never => { throw new Error('asked before (i) held'); };
  assert.equal(tailMoveKept(b, {crossings: 2, bends: 2}, ok, ok, () => 0), true, 'fewer bends, the same crossings');
  assert.equal(tailMoveKept(b, {crossings: 1, bends: 8}, ok, ok, () => 0), true, 'fewer crossings, more bends');
  assert.equal(tailMoveKept(b, {crossings: 2, bends: 4}, never, never, never), false, '(i): the same is not better; the others are not asked');
  assert.equal(tailMoveKept(b, {crossings: 3, bends: 0}, never, never, never), false, '(i): a crossing more');
  assert.equal(tailMoveKept(b, {crossings: 2, bends: 2}, () => true, ok, () => 0), false, '(ii): along another arrow\'s run');
  assert.equal(tailMoveKept(b, {crossings: 2, bends: 2}, ok, () => true, () => 0), false, '(iii): a pair of runs added');
  assert.equal(tailMoveKept(b, {crossings: 2, bends: 2}, ok, ok, () => 1), false, '(iv): the AND\'s arrows cross more');
  assert.equal(tailMoveKept(b, {crossings: 2, bends: 2}, ok, ok, () => -1), true, '(iv): fewer is fine');
});

test('D3 rule 6 (end to end): over random layered graphs with ANDs, the tails\' moves never add a crossing (total or among an AND\'s arrows) nor a bend', () => {
  let s = 20260421, moved = 0;
  const rnd = (n: number): number => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s % n; };
  for (let k = 0; k < 150; k++) {
    const layers = 2 + rnd(2), ids: string[][] = Array.from({length: layers}, (_, l) => Array.from({length: 1 + rnd(3)}, (_, j) => `n${l}${j}`));
    const boxes: Box[] = ids.flat().map(id => [id, 50 + 10 * rnd(3), 40 + 20 * rnd(8)]);
    const es: [string, string][] = [], and: number[] = [];
    for (let l = 1; l < layers; l++) for (const to of ids[l]!) {
      const from = ids[l - 1]!.filter(() => rnd(3) > 0);
      for (const f of from.length ? from : [ids[l - 1]![0]!]) { if (from.length > 1) and.push(es.length); es.push([f, to]); }
    }
    const {lay, on, off} = fig(boxes, es, and);
    const group = new Set(and);
    const a = scoreOf([...off.values()]), b = scoreOf([...on.values()]);
    assert.ok(b.crossings <= a.crossings && b.bends <= a.bends, `#${k}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
    // the arrows of one AND (all into one head): crossings among them
    const heads = new Set(lay.edges.filter(e => group.has(e.index)).map(e => e.to));
    for (const h of heads) {
      const pick = (m: Map<string, Pt[]>): Pt[][] => lay.edges.filter(e => e.to === h && group.has(e.index)).map(e => m.get(`${e.from}>${e.to}`)!);
      assert.ok(crossingsOf(pick(on)) <= crossingsOf(pick(off)), `#${k} head ${h}: the AND's arrows cross more`);
    }
    if (b.bends < a.bends) moved++;
  }
  assert.ok(moved >= 20, `the rule moved a tail in ${moved} of 150 figures`);
});

test('D3 rule 7: a jog of any size goes (2, 11, 22, 28, 39, 60px), as long as the target is inside the tail\'s box', () => {
  // one AND arrow a>h (a group of one); h is moved so that its head port is `d` px from a's middle
  const boxes: Box[] = [['a', 60, 400], ['h', 60, 100]], es: [string, string][] = [['a', 'h']];
  for (const d of [2, 11, 22, 28, 39, 60]) {
    const f = fig(boxes, es, [0], {y: {a: 0, h: 200 + d - 50}}), head = tip(f.off.get('a>h')!).y, tail = f.off.get('a>h')![0]!.y;
    assert.equal(Math.round(Math.abs(head - tail)), d, `the jog before is ${d}px`);
    assert.ok(straight(f.on.get('a>h')!), `${d}px: straight`);
  }
  // the same size at the head's other side
  const f = fig(boxes, es, [0], {y: {a: 0, h: 200 - 39 - 50}});
  assert.ok(straight(f.on.get('a>h')!), '39px above');
});

/** The arrows of an AND with a jog: two bends, the tail and the head a little apart across the layers (up to two port steps at the scale `s`; a longer way across is an elbow). */
const jogsOfAnds = (t: LaidOutCause, s = 1): string[] => {
  const inAnd = new Set(t.ands.flatMap(a => a.from.map(f => `${f}>${a.to}`)));
  return t.edges.filter(e => inAnd.has(`${e.from}>${e.to}`) && bendsOf(e.points) === 2 && Math.abs(e.points[0]!.x - tip(e.points).x) > 0.5 && Math.abs(e.points[0]!.x - tip(e.points).x) <= 2 * Math.round(22 * s) + 1).map(e => `${e.from}>${e.to}`);
};
const laid = async (d: Diagram): Promise<LaidOutCause> => (await checkDiagram(d)).laidOut.laidOut.find(b => b.type === 'cause') as LaidOutCause;

test('the reported CRT\'s shape: both AND jogs are gone (default, a wide canvas, asap, compact), the arc and the ports do not change, crossings and pairs do not go up', async () => {
  for (const [name, d] of [['default', crtReportShape()], ['wide', crtReportShape({}, 3600)], ['asap', crtReportShape({layer: 'asap'})]] as const) {
    const t = await laid(d);
    assert.deepEqual(jogsOfAnds(t, 1.29), [], `${name}: no jog in an AND`);
    assert.deepEqual(t.loose, [], `${name}: every AND keeps its arc`);
  }
  const t = await laid(crtReportShape());
  const scale = 1.29, {end} = andArc(scale);
  for (const a of t.ands) for (const e of t.edges.filter(e => e.to === a.to && a.from.includes(e.from))) {
    const p = e.points;
    assert.ok(Math.hypot(tip(p).x - p.at(-2)!.x, tip(p).y - p.at(-2)!.y) >= end + 1, `${e.from}>${e.to}: the last run holds the arc's room`);
  }
  const P = t.edges.map(e => e.points), bends = P.reduce((n, p) => n + bendsOf(p), 0);
  assert.ok(bends <= 54, `bends ${bends} (main drew 56: two jogs of 2 bends)`);
  assert.ok(crossingsOf(P) <= 5, `crossings ${crossingsOf(P)}`);
  const compact = crtReportShape();
  (compact as unknown as {density: string}).density = 'compact';
  assert.deepEqual(jogsOfAnds(await laid(compact), 1.29), [], 'compact: no jog in an AND');
});

test('examples/toc-*: the jogs of the arrows into an AND (39px in toc-core, 11px in toc-tt, 22px in toc-compact) are gone; a jog of an arrow in no AND stays (toc-crt-loop\'s switch>late)', async () => {
  const jogs: Record<string, string[]> = {};
  for (const name of ['toc-core', 'toc-tt', 'toc-compact', 'toc-crt', 'toc-legend', 'toc-frt', 'toc-hop-all', 'toc-crt-loop', 'toc-nbr']) {
    const loaded = await loadDiagram(new URL(`../examples/${name}.ts`, import.meta.url).pathname);
    const t = (await checkDiagram(loaded)).laidOut.laidOut.find(b => b.type === 'cause') as LaidOutCause;
    jogs[name] = jogsOfAnds(t);
  }
  for (const [name, j] of Object.entries(jogs)) assert.deepEqual(j, [], `${name}: no jog in an AND`);
  const crt = (await checkDiagram(await loadDiagram(new URL('../examples/toc-crt-loop.ts', import.meta.url).pathname))).laidOut.laidOut.find(b => b.type === 'cause') as LaidOutCause;
  const plain = crt.edges.filter(e => e.from === 'switch' && e.to === 'late');
  assert.equal(plain.length, 1);
  assert.equal(bendsOf(plain[0]!.points), 2, 'an arrow in no AND keeps its jog');
});

test('D3 changes neither the port step (22 / 28) nor the AND arc: the tips on a head are the same with the rule on and off', async () => {
  const {on, off} = fig(AB, AB_ES, [0, 1]);
  assert.deepEqual([...on].map(([k, p]) => [k, tip(p)]), [...off].map(([k, p]) => [k, tip(p)]));
  const t = await laid(crtReportShape()), s = (xs: number[]) => xs.slice(1).map((x, i) => Math.round((x - xs[i]!) * 100) / 100);
  const u4 = s(t.edges.filter(e => e.to === 'u4').map(e => tip(e.points).x).sort((p, q) => p - q));
  assert.equal(u4[1], 2 * u4[0]!, 'the boundary between the two groups is two steps');
  assert.deepEqual(andArc(1), {peak: 19, end: 25, reach: 10});
});

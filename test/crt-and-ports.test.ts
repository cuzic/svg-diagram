// ADR 0070 D3・D8 (U3): the ports next to an AND group are two steps apart, the AND arc keeps a visible gap from the arrowheads, and
// the last run into a head is long enough for the deeper arc (`headRun` = AND_END + 1). Nothing here fixes a size in px that depends on
// the font: the checks are ratios of port steps, the arc's constants, counts, and one figure compared with another.
import test from 'node:test';
import './helpers/strict-width.ts'; // a label the layout did not register for measuring throws instead of measuring 0 wide
import assert from 'node:assert/strict';
import {causeTree, checkDiagram, closeMeasurer, diagram} from '../lib/dsl.ts';
import type {Diagram} from '../lib/dsl.ts';
import type {LaidOutCause} from '../lib/types/diagrams.ts';
import {andArc} from '../lib/toc.ts';
import {ARROW_L} from '../lib/cause-hop.ts';
import {CRT_REPORT_LINKS, CRT_REPORT_NODES, CRT_REPORT_OPTIONS, crtReportShape} from './fixtures/crt-report-shape.ts';

test.after(() => closeMeasurer());

type Pt = {x: number; y: number};
const N = (id: string, extra: object = {}) => ({id, label: id, ...extra});
const laid = async (d: Diagram): Promise<LaidOutCause> => (await checkDiagram(d)).laidOut.laidOut.find(b => b.type === 'cause') as LaidOutCause;
const tipsInto = (t: LaidOutCause, to: string): {from: string; x: number}[] => t.edges.filter(e => e.to === to).map(e => ({from: e.from, x: e.points.at(-1)!.x})).sort((a, b) => a.x - b.x);
const steps = (xs: number[]): number[] => xs.slice(1).map((x, i) => Math.round((x - xs[i]!) * 100) / 100);
/** The x range an arc spans (dir 'up': the arrows arrive vertically, the arc lies across them). */
const spanOf = (a: LaidOutCause['ands'][number]): [number, number] => [Math.min(a.p0.x, a.p1.x), Math.max(a.p0.x, a.p1.x)];
/** Where the arc crosses the axis of an arrow whose tip is `tip` (the arc is a quadratic whose control point lies half-way across). */
const arcDepthAt = (a: LaidOutCause['ands'][number], tip: Pt): number => {
  const t = (tip.x - a.p0.x) / (a.p1.x - a.p0.x), y = (1 - t) ** 2 * a.p0.y + 2 * t * (1 - t) * a.c.y + t ** 2 * a.p1.y;
  return Math.abs(tip.y - y);
};
/** The visible gap between the arrowhead's base and the arc, the arc's line half-width (1) taken off. */
const visibleGap = (t: LaidOutCause): number => Math.min(...t.ands.flatMap(a => t.edges.filter(e => e.to === a.to && a.from.includes(e.from)).map(e => arcDepthAt(a, e.points.at(-1)!) - ARROW_L - 1)));

test('andArc: the visible gap to the arrowhead is 0.4 x the text size or more, at scale 1 (14) and at 1.29 (18)', () => {
  const one = andArc(1), big = andArc(1.29);
  assert.deepEqual(one, {peak: 19, end: 25, reach: 10}, 'ADR 0070 D8 at s = 1');
  assert.ok(one.peak - ARROW_L - 1 >= 0.4 * 14);
  assert.ok(big.peak - ARROW_L - 1 >= 0.4 * 18);
  assert.ok(big.end > one.end && big.reach > one.reach);
});

test('two ANDs into one head: the step between the groups is twice the step inside a group; the arcs keep 2 x step - 2 x AND_REACH apart', async () => {
  const t = await laid(diagram({theme: 'blue'}).add(causeTree([N('h', {role: 'ude'}), N('a'), N('b'), N('c'), N('d')], [{from: ['a', 'b'], to: 'h'}, {from: ['c', 'd'], to: 'h'}], {dir: 'up'})));
  const s = steps(tipsInto(t, 'h').map(e => e.x));
  assert.equal(s.length, 3);
  assert.equal(s[0], s[2], 'the two groups have the same inner step');
  assert.equal(s[1], 2 * s[0]!, 'the boundary between the groups is two steps');
  assert.equal(t.ands.length, 2);
  assert.deepEqual(t.loose, []);
  const [l, r] = t.ands.map(spanOf).sort((p, q) => p[0] - q[0]);
  assert.ok(r![0] - l![1] >= 2 * s[0]! - 2 * andArc().reach - 0.01, `arcs ${l} and ${r}`);
});

test('an AND and a lone arrow into one head: two steps between them; the AND inside keeps one step', async () => {
  const t = await laid(diagram({theme: 'blue'}).add(causeTree([N('h', {role: 'ude'}), N('a'), N('b'), N('c')], [{from: ['a', 'b'], to: 'h'}, {from: 'c', to: 'h'}], {dir: 'up'})));
  const tips = tipsInto(t, 'h'), s = steps(tips.map(e => e.x));
  const lone = tips.findIndex(e => e.from === 'c');
  assert.ok(lone === 0 || lone === 2, 'the lone arrow is outside the group');
  const inner = lone === 0 ? s[1]! : s[0]!, boundary = lone === 0 ? s[0]! : s[1]!;
  assert.equal(boundary, 2 * inner);
  assert.equal(t.ands.length, 1);
});

test('a head with no AND keeps its ports and its width: the same figure with another head made an AND, or not', async () => {
  // h has three OR causes; g's two causes are an AND in one figure and two ORs in the other
  const nodes = [N('h', {role: 'ude'}), N('g', {role: 'ude'}), N('a'), N('b'), N('c'), N('x'), N('y')];
  const fig = (and: boolean) => diagram({theme: 'blue'}).add(causeTree(nodes, [{from: 'a', to: 'h'}, {from: 'b', to: 'h'}, {from: 'c', to: 'h'}, ...(and ? [{from: ['x', 'y'], to: 'g'}] : [{from: 'x', to: 'g'}, {from: 'y', to: 'g'}])], {dir: 'up'}));
  const withAnd = await laid(fig(true)), without = await laid(fig(false));
  const box = (t: LaidOutCause, id: string) => t.anchors.find(a => a.id === id)!;
  const ports = (t: LaidOutCause, id: string) => tipsInto(t, id).map(e => Math.round((e.x - box(t, id).x) * 100) / 100);
  assert.equal(box(withAnd, 'h').w, box(without, 'h').w, 'the width of the head with no AND');
  assert.deepEqual(ports(withAnd, 'h'), ports(without, 'h'), 'its ports, from its left edge');
  assert.deepEqual(new Set(steps(tipsInto(without, 'h').map(e => e.x))).size, 1, 'an ordinary fan-in keeps one even step');
  assert.equal(withAnd.ands.length, 1);
  // the plain step is the step inside a group: widening every boundary (not only those next to an AND) would make it twice that
  assert.equal(steps(tipsInto(withAnd, 'h').map(e => e.x))[0], steps(tipsInto(withAnd, 'g').map(e => e.x))[0]);
});

test("the reported CRT's shape: every AND is drawn, its last runs hold AND_END + 1, the arc clears the arrowheads by 0.4 x minText, u4's two groups stand apart", async () => {
  const t = await laid(crtReportShape());
  const groups = CRT_REPORT_LINKS.filter(l => typeof l.from !== 'string');
  assert.equal(t.ands.length, groups.length, 'no AND loses its arc');
  assert.deepEqual(t.loose, []);
  const {end, reach} = andArc();
  for (const a of t.ands) for (const e of t.edges.filter(e => e.to === a.to && a.from.includes(e.from))) {
    const p = e.points, last = Math.hypot(p.at(-1)!.x - p.at(-2)!.x, p.at(-1)!.y - p.at(-2)!.y);
    assert.ok(last >= end + 1, `${e.from}->${e.to}: last run ${last} < AND_END + 1 = ${end + 1}`);
  }
  // the fixture's canvas. Every AND here has two arrows, which meet the arc beside its middle; the middle of a three-arrow AND is
  // AND_PEAK from the tip, 6px at s = 1 (< 7.2): that holds in general once the lines scale with the text (U5, s = 1.29: AND_PEAK 21, gap 8)
  const minText = 18;
  assert.ok(visibleGap(t) >= 0.4 * minText, `visible gap ${visibleGap(t)} < ${0.4 * minText}`);
  // u4: (e8, pre3) and (u3, pre4), four arrows: the step between the groups is twice the one inside, the arcs do not read as one
  const s = steps(tipsInto(t, 'u4').map(e => e.x));
  assert.equal(s[1], 2 * s[0]!);
  const [l, r] = t.ands.filter(a => a.to === 'u4').map(spanOf).sort((p, q) => p[0] - q[0]);
  assert.ok(r![0] - l![1] >= 2 * s[0]! - 2 * reach - 0.01, `u4's arcs ${l} and ${r}`);
});

/** Each arrow of each AND: its last run, and whether every AND got its arc. */
const lastRunsOfAnds = (t: LaidOutCause): number[] => t.ands.flatMap(a => t.edges.filter(e => e.to === a.to && a.from.includes(e.from)).map(e => {
  const p = e.points;
  return Math.hypot(p.at(-1)!.x - p.at(-2)!.x, p.at(-1)!.y - p.at(-2)!.y);
}));

test("at arc scale 1.29 (ADR 0070 U3, a test-only band key until D7): the reported CRT's shape draws every AND, every last run holds AND_END + 1", async () => {
  const s = 1.29, {end} = andArc(s);
  for (const opts of [{}, {layer: 'asap' as const}]) {
    const band = {...causeTree(CRT_REPORT_NODES, CRT_REPORT_LINKS, {...CRT_REPORT_OPTIONS, ...opts}), arcScale: s};
    const t = await laid(diagram({theme: 'blue', canvas: {width: 2600, height: 2000, minText: 18, fit: 'content'}}).add(band));
    assert.equal(t.ands.length, CRT_REPORT_LINKS.filter(l => typeof l.from !== 'string').length, `${JSON.stringify(opts)}: no AND loses its arc`);
    assert.deepEqual(t.loose, []);
    for (const r of lastRunsOfAnds(t)) assert.ok(r >= end + 1, `${JSON.stringify(opts)}: last run ${r} < AND_END + 1 = ${end + 1}`);
    assert.ok(visibleGap(t) >= 0.4 * 18, `visible gap ${visibleGap(t)}`);
  }
});

test('a three-arrow AND (with an ordinary arrow beside it and a long arrow in it): drawn, last runs hold AND_END + 1, the middle arrow clears the arc by 0.4 x 14', async () => {
  for (const s of [1, 1.29]) {
    const {end} = andArc(s);
    const band = {...causeTree([N('h', {role: 'ude'}), N('m'), N('a'), N('b'), N('c'), N('d'), N('r', {role: 'root'})],
      [{from: 'r', to: 'm'}, {from: ['a', 'b', 'm'], to: 'h'}, {from: 'c', to: 'h'}, {from: 'd', to: 'c'}], {tree: 'crt', dir: 'up'}), arcScale: s};
    const t = await laid(diagram({theme: 'blue'}).add(band));
    assert.equal(t.ands.length, 1, `s = ${s}`);
    assert.deepEqual(t.loose, []);
    for (const r of lastRunsOfAnds(t)) assert.ok(r >= end + 1, `s = ${s}: last run ${r} < ${end + 1}`);
    assert.ok(visibleGap(t) >= 0.4 * 14 * s, `s = ${s}: visible gap ${visibleGap(t)}`);
  }
});

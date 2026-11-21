// ADR 0070 D7 (U5): on a canvas, a cause tree's lines scale with the text: s = max(1, the canvas's font scale), unit = space x s. Nothing here
// fixes a size in px that depends on the font: the checks are ratios (spacing / text size), the module's own constants times the scale, counts,
// and one figure against another.
import test from 'node:test';
import './helpers/strict-width.ts'; // a label the layout did not register for measuring throws instead of measuring 0 wide
import assert from 'node:assert/strict';
import {caption, causeTree, checkDiagram, closeMeasurer, diagram, pdpc} from '../lib/dsl.ts';
import type {Diagram} from '../lib/dsl.ts';
import type {CauseBand, LaidOutCause} from '../lib/types/diagrams.ts';
import {LANE, gapFor, laneStepOf, layoutWithLanes, routeLayered, stubOf} from '../lib/layered-route.ts';
import {andArc, layoutCauseBand} from '../lib/toc.ts';
import {canvasFontScale} from '../lib/tokens.ts';
import {parallelRuns} from '../lib/polyline-metrics.ts';
import {ARROW_L} from '../lib/cause-hop.ts';
import {CRT_REPORT_LINKS, CRT_REPORT_NODES, CRT_REPORT_OPTIONS, crtReportShape} from './fixtures/crt-report-shape.ts';

test.after(() => closeMeasurer());

type Pt = {x: number; y: number};
const S18 = canvasFontScale(18);
const checked = async (d: Diagram) => { const r = await checkDiagram(d); return {r, t: r.laidOut.laidOut.find(b => b.type === 'cause') as LaidOutCause}; };
const routesOf = (t: LaidOutCause): Pt[][] => t.edges.map(e => e.points);
/** The smallest gap between two runs side by side (on one axis, over 4px together, not on one line). */
const minSpacing = (t: LaidOutCause): number => Math.min(...parallelRuns(routesOf(t), 1000).filter(p => p.gap > 0.5).map(p => p.gap));
const causeCrossings = (r: {verdict: {warnings: string[]}}): number => r.verdict.warnings.filter(w => w.startsWith('[cause-crossing]')).length;
const withDensity = (d: Diagram, density: 'compact'): Diagram => { (d as unknown as {density: string}).density = density; return d; };
/** The CRT of the report, drawn with `canvasOpts` (none: no canvas). */
const crtFigure = (canvas?: {minText: number}) => diagram({theme: 'blue', ...(canvas ? {canvas: {width: 2600, height: 2000, fit: 'content' as const, ...canvas}} : {width: 2600})})
  .add(causeTree(CRT_REPORT_NODES, CRT_REPORT_LINKS, CRT_REPORT_OPTIONS));

test('two figures that differ only in having a canvas: the least side-by-side spacing / the text size is the same', async () => {
  const plain = (await checked(crtFigure())).t, big = (await checked(crtFigure({minText: 18}))).t;
  assert.equal(minSpacing(plain) / 14, minSpacing(big) / 18, `plain ${minSpacing(plain)}, canvas ${minSpacing(big)}`);
});

test('the table of ADR 0070 D7: ports, boxes, the AND arc and the box gap take the scale; the lane step is LANE x unit', async () => {
  // the ports into a head: PORT x s apart (the boxes are as wide as that needs, `need`)
  const plain = (await checked(crtFigure())).t, big = (await checked(crtFigure({minText: 18}))).t;
  const portStep = (t: LaidOutCause): number => {
    const xs = t.edges.filter(e => e.to === 'u4').map(e => e.points.at(-1)!.x).sort((a, b) => a - b);
    return Math.min(...xs.slice(1).map((x, i) => x - xs[i]!));
  };
  assert.equal(portStep(plain), 22);
  assert.equal(portStep(big), Math.round(22 * S18));
  // the arc follows the text (D8): the 0.4 x text gap, at the canvas's own scale
  assert.deepEqual(andArc(S18), andArc(canvasFontScale(18)));
  const gap = Math.min(...big.ands.flatMap(a => big.edges.filter(e => e.to === a.to && a.from.includes(e.from)).map(e => {
    const tip = e.points.at(-1)!, t = (tip.x - a.p0.x) / (a.p1.x - a.p0.x), y = (1 - t) ** 2 * a.p0.y + 2 * t * (1 - t) * a.c.y + t ** 2 * a.p1.y;
    return Math.abs(tip.y - y) - ARROW_L - 1;
  })));
  assert.ok(gap >= 0.4 * 18, `visible gap ${gap}`);
  // adjacent lanes of a gap are LANE x unit apart, the gap holds them (gapFor with the scale); at scale 1 it is what it was
  for (const [space, s] of [[1, 1], [1, 1.29], [1, 1.5], [0.75, 1.29]] as const) {
    const unit = space * s, step = laneStepOf(unit);
    assert.equal(step, Math.round(LANE * unit));
    const box = (id: string, h = 30) => ({id, size: {w: 60, h}});
    const nodes = [box('a0', 90), box('a1'), box('a2'), box('a3'), box('b0', 90), box('b1', 90)];
    const edges = [{from: 'a0', to: 'b0'}, {from: 'a1', to: 'b0'}, {from: 'a2', to: 'b0'}, {from: 'a3', to: 'b1'}, {from: 'a0', to: 'b1'}]; // five direct arrows through one gap
    const lay = layoutWithLanes(nodes, edges, {dir: 'right', gap: 24, levelGap: 20}, 0, space, s);
    const routes = routeLayered(lay, p => p, Math.round(22 * s), undefined, undefined, false, false, false, false, false, space, false, {}, true, s);
    const xs = [...routes.values()].flatMap(r => r.flatMap((p, k) => k > 0 && p.x === r[k - 1]!.x && p.y !== r[k - 1]!.y ? [p.x] : [])).sort((a, b) => a - b);
    assert.ok(xs.length >= 5, 'five lanes');
    const gaps = xs.slice(1).map((x, i) => x - xs[i]!);
    assert.ok(gaps.every(g => g >= step - 0.01), `space ${space}, s ${s}: lanes ${gaps} under the step ${step}`);
    assert.ok(Math.min(...gaps) <= 2 * step, 'the gap is as wide as the lanes need, not more');
    assert.equal(parallelRuns([...routes.values()], step).length, 0, `space ${space}, s ${s}`);
    assert.equal(gapFor(3, 0, space, s) >= 2 * stubOf(unit) + 2 * step, true);
  }
  assert.equal(gapFor(3, 0, 1), gapFor(3, 0, 1, 1));
  assert.ok(gapFor(3, 0, 1, 1.29) > gapFor(3, 0, 1, 1));
});

test("a canvas with small text keeps today's spacing (s >= 1): minText 10 and 14 draw what no canvas draws, spacing-wise", async () => {
  for (const minText of [10, 14]) {
    const {t} = await checked(crtFigure({minText}));
    assert.ok(minSpacing(t) >= laneStepOf(1), `minText ${minText}: ${minSpacing(t)}`);
    assert.equal(parallelRuns(routesOf(t), laneStepOf(1)).length, 0);
  }
});

// a causeTree's band alone, with a fixed text width: a band with no canvas is the figure that was, and the bands that are not a causeTree's own ignore the scale
const fixedW = (t: string, size: number): number => t.length * size * 0.6;
const ROLES = {body: 14, note: 12} as never;
const N = (id: string, extra: object = {}) => ({id, label: id, ...extra});
const place = (band: CauseBand, lineScale?: number): LaidOutCause => layoutCauseBand(band, 0, 0, 1800, fixedW as never, ROLES, {wrap: 'phrase', keepWords: false, ...(lineScale === undefined ? {} : {lineScale})});

test('no canvas (lineScale 1 or none) is the layout that was; a band of pdpc() ignores the scale; a causeTree grows with it', () => {
  const steps = [N('s1'), N('s2'), N('s3')];
  const nodes = [N('start', {role: 'start'}), ...steps, N('goal', {role: 'goal'})], links = [...steps.map(s => ({from: 'start', to: s.id})), ...steps.map(s => ({from: s.id, to: 'goal'}))];
  const tree = causeTree([N('r', {role: 'root'}), N('a'), N('b'), N('c'), N('h', {role: 'ude'})], [{from: 'r', to: 'a'}, {from: 'r', to: 'b'}, {from: ['a', 'b'], to: 'h'}, {from: 'r', to: 'c'}, {from: 'c', to: 'h'}], {dir: 'up'});
  assert.deepEqual(place(tree, 1), place(tree));
  assert.deepEqual(place(pdpc(nodes, links)), place(pdpc(nodes, links), 1.29), 'pdpc: the same layout whatever the scale');
  const one = place(tree), big = place(tree, 1.29);
  assert.ok(big.h > one.h, `taller: ${one.h} -> ${big.h}`);
});

test("the reported CRT's shape (U0 fixture, minText 18): the completion criteria of ADR 0070 at the scale", async () => {
  const {r, t} = await checked(crtReportShape());
  const space = 1, step = laneStepOf(space * S18), P = routesOf(t);
  const bends = Math.max(...P.map(p => { let n = 0; for (let k = 2; k < p.length; k++) if ((p[k]!.x - p[k - 1]!.x === 0) !== (p[k - 1]!.x - p[k - 2]!.x === 0)) n++; return n; }));
  assert.ok(bends <= 4, `bends ${bends}`);
  assert.equal(parallelRuns(P, step).length, 0, 'no pair of runs under the scaled lane step');
  assert.equal(causeCrossings(r), 0);
  assert.deepEqual(t.loose, []);
  assert.ok(minSpacing(t) / 18 >= 0.9, `spacing / minText ${minSpacing(t) / 18}`);
  // the arcs of the AND: the cut between two is 2 x portStep - 2 x AND_REACH
  const {reach} = andArc(S18), portStep = Math.round(22 * S18);
  const into = new Map<string, LaidOutCause['ands']>();
  for (const a of t.ands) into.set(a.to, [...(into.get(a.to) ?? []), a]);
  for (const [to, list] of into) {
    const spans = list.map(a => [Math.min(a.p0.x, a.p1.x), Math.max(a.p0.x, a.p1.x)] as const).sort((p, q) => p[0] - q[0]);
    for (let k = 1; k < spans.length; k++) assert.ok(spans[k]![0] - spans[k - 1]![1] >= 2 * portStep - 2 * reach - 0.01, `arcs into ${to}`);
  }
});

test("the reported CRT's shape with density: 'compact': the spacing / minText is at least 0.7, and nothing under the lane step", async () => {
  const d = withDensity(crtReportShape(), 'compact');
  const {r, t} = await checked(d);
  assert.ok(minSpacing(t) / 18 >= 0.7, `spacing / minText ${minSpacing(t) / 18}`);
  assert.equal(parallelRuns(routesOf(t), laneStepOf(0.75 * S18)).length, 0);
  assert.equal(causeCrossings(r), 0);
  assert.deepEqual(t.loose, []);
});

test('a figure that fits only with the old lines is drawn with them: the scale never turns a drawn figure into an error', () => {
  const tree = causeTree([N('r', {role: 'root'}), N('a'), N('b'), N('c'), N('d'), N('h', {role: 'ude'})], [{from: 'r', to: 'a'}, {from: 'r', to: 'b'}, {from: 'a', to: 'c'}, {from: 'b', to: 'd'}, {from: ['c', 'd'], to: 'h'}, {from: 'r', to: 'h'}], {dir: 'up'});
  const draw = (lineScale: number | undefined, budget?: number): LaidOutCause => layoutCauseBand(tree, 0, 0, 1800, fixedW as never, ROLES, {wrap: 'phrase', keepWords: false, ...(lineScale === undefined ? {} : {lineScale})}, budget, true);
  const old = draw(undefined), scaled = draw(1.29);
  assert.ok(scaled.h > old.h, `${old.h} -> ${scaled.h}`);
  const squeezed = draw(1.29, old.h + 1); // a canvas just tall enough for the old lines
  assert.deepEqual(squeezed.edges, old.edges);
  assert.throws(() => draw(undefined, old.h - 20), /does not fit/, 'a canvas too short for the old lines still says so');
});

import {lintDiagram} from '../lib/rules.ts';

test('a figure drawn with the old lines is told so (cause-line-scale-dropped, info), and edge-parallel measures at the scaled lane step', async () => {
  const mk = (height: number) => diagram({theme: 'blue', canvas: {width: 2600, height, minText: 18, fit: 'content'}}).add(causeTree(CRT_REPORT_NODES, CRT_REPORT_LINKS, CRT_REPORT_OPTIONS));
  const tall = (await checked(mk(2000))).t;
  assert.ok(!tall.lineScaleDropped, 'room enough: the scaled lines');
  assert.deepEqual(lintDiagram((await checkDiagram(mk(2000))).laidOut).filter(f => f.rule === 'cause-line-scale-dropped'), []);
  // a canvas too short for the scaled figure (1818 + the title), tall enough for the old one (1584)
  const short = await checkDiagram(mk(1700));
  const band = short.laidOut.laidOut.find(b => b.type === 'cause') as LaidOutCause;
  assert.equal(band.lineScaleDropped, true);
  const found = lintDiagram(short.laidOut);
  assert.equal(found.filter(f => f.rule === 'cause-line-scale-dropped').length, 1);
  assert.equal(found.find(f => f.rule === 'cause-line-scale-dropped')!.severity, 'info');
  assert.ok(minSpacing(band) < laneStepOf(S18), 'the old lines are 14px apart');
  // edge-parallel: measured at 18px on a canvas, so the fallback figure's 14px lanes are reported; the scaled figure's are not
  assert.ok(found.some(f => f.rule === 'edge-parallel'), 'the fallback figure is reported by edge-parallel');
  assert.deepEqual(lintDiagram((await checkDiagram(mk(2000))).laidOut).filter(f => f.rule === 'edge-parallel'), []);
});

test('canvas の高さ: 広げた線で内容が canvas を超えるが、広げない線なら収まる図は、広げない線で描く (cause-line-scale-dropped)、十分高い canvas なら出ない', async () => {
  const mk = (height: number) => crtReportShape(undefined, 2600, height);
  const bandOf = (r: Awaited<ReturnType<typeof checkDiagram>>) => r.laidOut.laidOut.find(b => b.type === 'cause') as LaidOutCause;
  const tryHeight = async (h: number) => { try { return await checkDiagram(mk(h)); } catch { return undefined; } };
  // 高さは測った値から決める (CI のフォントで px が違う): 広げた図の内容の高さ、広げない図の内容の高さ (これが入る最小の canvas の高さから測る)
  const roomy = (await tryHeight(100000))!, scaledC = roomy.laidOut.contentHeight!;
  assert.equal(bandOf(roomy).lineScaleDropped, undefined);
  let lo = 1, hi = scaledC;
  while (hi - lo > 4) { const mid = Math.floor((lo + hi) / 2); if (await tryHeight(mid)) hi = mid; else lo = mid; }
  const oldC = (await tryHeight(hi))!.laidOut.contentHeight!;
  assert.ok(oldC < scaledC, `old ${oldC} < scaled ${scaledC}`);
  const between = Math.floor((oldC + scaledC) / 2) + 1;
  const r = await checkDiagram(mk(between));
  assert.equal(bandOf(r).lineScaleDropped, true);
  assert.ok(r.laidOut.contentHeight! <= between);
  assert.ok(!r.verdict.warnings.some(w => w.includes('slide-canvas-overflow')), r.verdict.warnings.join('\n'));
  assert.equal(lintDiagram(r.laidOut).filter(f => f.rule === 'cause-line-scale-dropped').length, 1);
  assert.ok(!lintDiagram(r.laidOut).some(f => f.rule === 'slide-canvas-overflow'));
  const enough = await checkDiagram(mk(scaledC));
  assert.equal(bandOf(enough).lineScaleDropped, undefined);
  assert.deepEqual(lintDiagram(enough.laidOut).filter(f => f.rule === 'cause-line-scale-dropped'), []);
  assert.ok(!lintDiagram(enough.laidOut).some(f => f.rule === 'slide-canvas-overflow'));
});

test('canvas の高さ (ADR 0070 U5): 下の帯 (凡例・出典) と合わせて広げた線で canvas を超え、広げない線なら収まる図は、図全体を広げない線で描き直す', async () => {
  const mk = (height: number) => diagram({theme: 'blue', title: 'タイトル', showTitle: true, legend: 'auto', sourceLine: '出典: ダミー', canvas: {width: 2600, height, minText: 18, fit: 'content'}})
    .add(causeTree(CRT_REPORT_NODES, CRT_REPORT_LINKS, CRT_REPORT_OPTIONS));
  const bandOf = (r: Awaited<ReturnType<typeof checkDiagram>>) => r.laidOut.laidOut.find(b => b.type === 'cause') as LaidOutCause;
  const overflow = (r: Awaited<ReturnType<typeof checkDiagram>>) => r.verdict.warnings.some(w => w.includes('slide-canvas-overflow')) || lintDiagram(r.laidOut).some(f => f.rule === 'slide-canvas-overflow');
  const dropped = (r: Awaited<ReturnType<typeof checkDiagram>>) => lintDiagram(r.laidOut).filter(f => f.rule === 'cause-line-scale-dropped').length;
  const tryHeight = async (h: number) => { try { return await checkDiagram(mk(h)); } catch { return undefined; } };
  // 高さは測った値から決める (CI のフォントで px が違う)
  const roomy = (await tryHeight(100000))!, scaledC = roomy.laidOut.contentHeight!;
  assert.equal(bandOf(roomy).lineScaleDropped, undefined);
  let lo = 1, hi = scaledC; // 図全体が収まる最小の canvas の高さ = 広げない線の内容の高さ
  while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2), r = await tryHeight(mid); if (r && r.laidOut.contentHeight! <= mid) hi = mid; else lo = mid; }
  const oldC = (await tryHeight(hi))!.laidOut.contentHeight!;
  assert.ok(oldC < scaledC, `old ${oldC} < scaled ${scaledC}`);
  // 広げた図は内容の高さが canvas を 1px 超える (cause 帯だけなら予算に収まる): 下の帯のせいで超える
  const between = scaledC - 1, r = await checkDiagram(mk(between));
  assert.equal(bandOf(r).lineScaleDropped, true);
  assert.ok(r.laidOut.contentHeight! <= between);
  assert.equal(dropped(r), 1);
  assert.ok(!overflow(r), r.verdict.warnings.join('\n'));
  // 十分高い canvas: どちらも出ない
  const enough = await checkDiagram(mk(scaledC));
  assert.equal(bandOf(enough).lineScaleDropped, undefined);
  assert.equal(dropped(enough), 0);
  assert.ok(!overflow(enough));
  // 広げない線でも超える (下に帯が多い図): 広げた線のまま、overflow の警告が出る (cause-line-scale-dropped は出ない)
  const tall = (height: number) => { const d = mk(height); for (let k = 0; k < 14; k++) d.add(caption(`下の帯 ${k}`)); return d; };
  const tryTall = async (h: number) => { try { return await checkDiagram(tall(h)); } catch { return undefined; } };
  const scaledT = (await tryTall(100000))!.laidOut.contentHeight!;
  let lo2 = 1, hi2 = scaledT;
  while (hi2 - lo2 > 1) { const mid = Math.floor((lo2 + hi2) / 2), t = await tryTall(mid); if (t && t.laidOut.contentHeight! <= mid) hi2 = mid; else lo2 = mid; }
  assert.ok(hi2 < scaledT, 'the old lines fit a shorter canvas');
  const both = await tryTall(hi2 - 1)!; // hi2: the least canvas the old lines fit; one px under it, neither fits (and the cause band alone fits the canvas)
  assert.ok(both, 'laid out');
  assert.equal(bandOf(both).lineScaleDropped, undefined);
  assert.equal(dropped(both), 0);
  assert.ok(overflow(both));
  assert.equal(both.laidOut.contentHeight, scaledT);
  // 下の帯のせいで超える図も、広げない線で収まる高さなら描き直す
  const fits = await checkDiagram(tall(hi2));
  assert.equal(bandOf(fits).lineScaleDropped, true);
  assert.ok(!overflow(fits));
  void oldC;
});

// ADR 0070 D4 (U4a): each turn of a long arrow across a gap gets a track of its own (`tracks`, a cause tree's own band only). The
// routing is checked on a layout of fixed box sizes (no font); the reported CRT's shape only for counts and for which runs lie on one line.
import test from 'node:test';
import './helpers/strict-width.ts'; // a label the layout did not register for measuring throws instead of measuring 0 wide
import assert from 'node:assert/strict';
import {laneStepOf, layoutWithLanes, routeLayered} from '../lib/layered-route.ts';
import {parallelRuns, scoreOf} from '../lib/polyline-metrics.ts';
import type {Pt} from '../lib/graph-layout.ts';
import {checkDiagram, closeMeasurer} from '../lib/dsl.ts';
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
  assert.ok(pairs.reduce((s, p) => s + p.overlap, 0) <= 2 * LANE, `what is left is under the check's threshold: ${JSON.stringify(pairs)}`);
  assert.equal(parallel, 0);
  assert.equal(crossing, 0);
  assert.deepEqual(t.loose, []);
});

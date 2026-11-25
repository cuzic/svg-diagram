// ADR 0070 D2 (U2): parallelRuns and the edge-parallel check. The measure is checked on hand-built routes (numbers, no font); the real
// figures only for counts (pairs, zero or not) and for which bands the check reads, never for a size in px.
import test from 'node:test';
import './helpers/strict-width.ts'; // a label the layout did not register for measuring throws instead of measuring 0 wide
import assert from 'node:assert/strict';
import {RULE_DOCS} from '../lib/rules.ts';
import {parallelEdgeFindings} from '../lib/verify-cause-spacing.ts';
import {parallelRuns, runsTogether, type P} from '../lib/polyline-metrics.ts';
import {laneStepOf} from '../lib/layered-route.ts';
import {causeTree, checkDiagram, closeMeasurer, diagram, pdpc, relationDiagram, whyWhyTree} from '../lib/dsl.ts';
import type {Diagram} from '../lib/dsl.ts';
import type {LaidOutCause} from '../lib/types/diagrams.ts';
import {crtReportShape} from './fixtures/crt-report-shape.ts';

test.after(() => closeMeasurer());

type Target = Parameters<typeof parallelEdgeFindings>[0];
type Edge = {from: string; to: string; points: P[]};
const withBand = (band: object, extra: object = {}): Target => ({...diagram({theme: 'blue', title: 't', ...extra}), laidOut: [band]}) as unknown as Target;
const causeBand = (edges: Edge[], extra: object = {}) => ({type: 'cause', x: 0, y: 0, w: 400, h: 300, edges, ...extra});
const parallel = (d: Target) => parallelEdgeFindings(d);
/** Two level arrows `gap` apart, `len` long together. */
const pair = (gap: number, len: number, ends: [string, string, string, string] = ['a', 'b', 'c', 'd']): Edge[] => [
  {from: ends[0], to: ends[1], points: [{x: 0, y: 0}, {x: len, y: 0}]},
  {from: ends[2], to: ends[3], points: [{x: 0, y: gap}, {x: len, y: gap}]},
];
const laid = async (d: Diagram): Promise<{band: LaidOutCause; findings: string[]}> => {
  const r = await checkDiagram(d);
  return {band: r.laidOut.laidOut.find(b => b.type === 'cause') as LaidOutCause, findings: r.verdict.findings.filter(f => f.rule === 'edge-parallel').map(f => f.message)};
};

test('parallelRuns: runs on one axis under sep apart and over 4px together, with their gap and overlap', () => {
  const r = parallelRuns([[{x: 0, y: 0}, {x: 100, y: 0}], [{x: 40, y: 10}, {x: 200, y: 10}]], 14);
  assert.deepEqual(r, [{a: 0, b: 1, gap: 10, overlap: 60}]);
  assert.deepEqual(parallelRuns([[{x: 0, y: 0}, {x: 100, y: 0}], [{x: 40, y: 14}, {x: 200, y: 14}]], 14), [], 'exactly sep apart is not under sep');
  assert.deepEqual(parallelRuns([[{x: 0, y: 0}, {x: 100, y: 0}], [{x: 96, y: 2}, {x: 200, y: 2}]], 14), [], '4px together is not over 4px');
  assert.deepEqual(parallelRuns([[{x: 0, y: 0}, {x: 100, y: 0}], [{x: 50, y: -50}, {x: 50, y: 50}]], 14), [], 'a level run and a plumb run are not side by side');
  // either direction; plumb runs too; a run cut into collinear pieces is one run
  assert.deepEqual(parallelRuns([[{x: 0, y: 100}, {x: 0, y: 50}, {x: 0, y: 0}], [{x: 3, y: 0}, {x: 3, y: 100}]], 14), [{a: 0, b: 1, gap: 3, overlap: 100}]);
  // a slanted segment is not a run, and a route is never compared with itself
  assert.deepEqual(parallelRuns([[{x: 0, y: 0}, {x: 100, y: 5}], [{x: 0, y: 1}, {x: 100, y: 6}]], 14), []);
  assert.deepEqual(parallelRuns([[{x: 0, y: 0}, {x: 100, y: 0}, {x: 100, y: 5}, {x: 0, y: 5}]], 14), []);
});

test('parallelRuns: arrows that share a tail or a head count (the routes carry no ends; nothing is left out for them)', () => {
  // two arrows out of one point that run together before they part, and two that come together into one head
  const tail = [[{x: 0, y: 0}, {x: 0, y: 50}, {x: 30, y: 50}], [{x: 0, y: 0}, {x: 0, y: 50}, {x: -30, y: 50}]];
  assert.deepEqual(parallelRuns(tail, 14), [{a: 0, b: 1, gap: 0, overlap: 50}]);
  const head = [[{x: -30, y: 0}, {x: -30, y: 40}, {x: 0, y: 40}, {x: 0, y: 100}], [{x: 30, y: 0}, {x: 30, y: 40}, {x: 6, y: 40}, {x: 6, y: 100}]];
  assert.deepEqual(parallelRuns(head, 14).map(p => [p.gap, p.overlap]), [[6, 60]]);
});

test('parallelRuns(·, 4) agrees with runsTogether on single runs (runsTogether is unchanged)', () => {
  const runs = [0, 3, 3.9, 4, 6].flatMap(gap => [2, 4, 5, 30].flatMap(len => [true, false].map(level => ({gap, len, level}))));
  for (const {gap, len, level} of runs) {
    const a = {p: {x: 0, y: 0}, q: level ? {x: 100, y: 0} : {x: 0, y: 100}};
    const b = level ? {p: {x: 100 - len, y: gap}, q: {x: 200, y: gap}} : {p: {x: gap, y: 100 - len}, q: {x: gap, y: 200}};
    assert.equal(parallelRuns([[a.p, a.q], [b.p, b.q]], 4).length > 0, runsTogether(a, b), `gap ${gap}, len ${len}, ${level ? 'level' : 'plumb'}`);
  }
});

test('edge-parallel: a cause tree band with runs under the lane step over 2 × the lane step in all is reported (info; warn when strict)', () => {
  const sep = laneStepOf();
  const hit = parallel(withBand(causeBand(pair(6, 2 * sep + 1))));
  assert.equal(hit.length, 1);
  assert.equal(hit[0]!.severity, 'info');
  assert.match(hit[0]!.message, /a → b と c → d（間隔 6px/);
  assert.equal(hit[0]!.data?.threshold, 2 * sep);
  assert.equal(hit[0]!.data?.measured, 2 * sep + 1);
  assert.deepEqual(parallel(withBand(causeBand(pair(6, 2 * sep)))), [], 'exactly 2 × the lane step in all is not reported');
  assert.deepEqual(parallel(withBand(causeBand(pair(sep, 200)))), [], 'a lane step apart is not side by side');
  assert.equal(parallel(withBand(causeBand(pair(6, 200)), {layoutCheck: 'strict'}))[0]?.severity, 'warn');
  assert.equal(parallel(withBand(causeBand(pair(0, 200, ['a', 'b', 'a', 'c'])))).length, 1, 'arrows from one tail count');
  assert.equal(parallel(withBand(causeBand(pair(0, 200, ['a', 'c', 'b', 'c'])))).length, 1, 'arrows into one head count');
  // the message names the three longest pairs and says there are more
  const many = [0, 1, 2, 3].flatMap(k => pair(2, 100 + k, [`a${k}`, `b${k}`, `c${k}`, `d${k}`]).map(e => ({...e, points: e.points.map(p => ({x: p.x, y: p.y + 100 * k}))})));
  assert.match(parallel(withBand(causeBand(many)))[0]!.message, /4 組、計 406px（a3 → b3 と c3 → d3（間隔 2px、103px）、a2 .+ ほか）/);
});

test("edge-parallel: density 'compact' measures with its own lane step", () => {
  const normal = laneStepOf(), compact = laneStepOf(0.75);
  assert.ok(compact < normal);
  const gap = compact; // side by side at the normal step, not at the compact one
  assert.equal(parallel(withBand(causeBand(pair(gap, 200)))).length, 1);
  assert.deepEqual(parallel(withBand(causeBand(pair(gap, 200)), {density: 'compact'})), []);
  assert.equal(parallel(withBand(causeBand(pair(gap, 200), {densityRestored: true}), {density: 'compact'})).length, 1, 'a band drawn at the normal gaps is measured at the normal step');
});

test('edge-parallel: only a cause tree band; a band with an origin (pdpc / relationDiagram / whyWhyTree) and other routed bands get none', () => {
  for (const origin of ['pdpc', 'relation', 'whywhy']) assert.deepEqual(parallel(withBand(causeBand(pair(0, 200), {origin}))), [], origin);
  for (const type of ['states', 'classes', 'bpmn']) assert.deepEqual(parallel(withBand({...causeBand(pair(0, 200)), type})), [], type);
  assert.equal(parallel(withBand({type: 'row', x: 0, y: 0, w: 400, h: 300, children: [causeBand(pair(0, 200), {id: 'c1'})]})).length, 1, 'a cause tree in a row is read');
  assert.ok(Object.hasOwn(RULE_DOCS, 'edge-parallel'), 'check --explain edge-parallel reads RULE_DOCS');
});

test('origin: set by pdpc(), relationDiagram() and whyWhyTree(); no key on a cause tree (its layout JSON is as before)', async () => {
  const nodes = [{id: 'a', label: 'a'}, {id: 'b', label: 'b'}, {id: 'c', label: 'c'}];
  const links = [{from: 'a', to: 'b'}, {from: 'b', to: 'c'}];
  const fig = (band: ReturnType<typeof causeTree>) => diagram({theme: 'blue', title: 't'}).add(band);
  assert.equal((await laid(fig(pdpc(nodes, links)))).band.origin, 'pdpc');
  assert.equal((await laid(fig(relationDiagram(nodes, links)))).band.origin, 'relation');
  assert.equal((await laid(diagram({theme: 'blue', title: 't'}).add(...whyWhyTree('p', [{why: 'w', because: [{why: 'v', trueCause: true}]}])))).band.origin, 'whywhy');
  assert.ok(!Object.hasOwn((await laid(fig(causeTree(nodes, links)))).band, 'origin'));
  assert.ok(!Object.hasOwn((await laid(fig(causeTree(nodes, links, {tree: 'crt'})))).band, 'origin'));
});

test("edge-parallel on the reported CRT's shape: none under layer: 'asap' since the long arrows' turns have tracks (ADR 0070 U4a), none with the default", async () => {
  const asap = await laid(crtReportShape({layer: 'asap'})), byDefault = await laid(crtReportShape());
  const pairs = (t: LaidOutCause) => parallelRuns(t.edges.map(e => e.points), laneStepOf());
  // asap had 17 pairs (1329px, one finding) before U4a; what is left is two arrows into one head, before it (their last turns: U4b)
  for (const p of pairs(asap.band)) assert.equal(asap.band.edges[p.a]!.to, asap.band.edges[p.b]!.to, JSON.stringify(p));
  assert.deepEqual(asap.findings, []);
  assert.equal(pairs(byDefault.band).length, 0);
  assert.deepEqual(byDefault.findings, []);
});

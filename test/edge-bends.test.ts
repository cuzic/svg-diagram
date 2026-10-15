// node --test test/   — ADR 0016 D6 (U6): the edge-bends rule. The numbers come from hand-built routes, so no font is involved;
// the real figures are only checked for what they hand to the rule (a route for every arrow, as a polyline).
import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/strict-width.ts';
import {lintDiagram} from '../lib/rules.ts';
import {bendsOf} from '../lib/polyline-metrics.ts';
import {causalLoop, causeTree, checkDiagram, closeMeasurer, dependencyNetwork, diagram, pert, stateDiagram} from '../lib/dsl.ts';
import type {LaidOutConnect} from '../lib/types/containers.ts';

test.after(() => closeMeasurer());

type Pts = {x: number; y: number}[];
type Target = Parameters<typeof lintDiagram>[0];
/** A staircase with exactly `n` bends. */
function stairs(n: number): Pts {
  const out = [{x: 0, y: 0}];
  for (let i = 0; i <= n; i++) { const p = out[out.length - 1]; out.push(i % 2 === 0 ? {x: p.x + 10, y: p.y} : {x: p.x, y: p.y + 10}); }
  return out;
}
const withBand = (band: object, extra: object = {}): Target => ({...diagram({theme: 'blue', title: 't', ...extra}), laidOut: [band]}) as unknown as Target;
const withEdges = (type: 'cause' | 'states' | 'bpmn' | 'classes', edges: {from: string; to: string; points: Pts}[], extra: object = {}): Target => withBand({type, x: 0, y: 0, w: 400, h: 300, edges}, extra);
const bends = (d: Target) => lintDiagram(d).filter(f => f.rule === 'edge-bends');

test('edge-bends: the fixtures have the bends they claim', () => {
  for (const n of [0, 1, 4, 5, 6]) assert.equal(bendsOf(stairs(n)), n, `stairs(${n})`);
});

test('edge-bends: one edge with 5 bends is reported (info by default); 4 bends is not', () => {
  const hit = bends(withEdges('cause', [{from: 'a', to: 'b', points: stairs(5)}]));
  assert.equal(hit.length, 1);
  assert.equal(hit[0].severity, 'info');
  assert.match(hit[0].message, /a → b が 5 回/);
  assert.equal(hit[0].data?.threshold, 5);
  assert.deepEqual(bends(withEdges('cause', [{from: 'a', to: 'b', points: stairs(4)}, {from: 'a', to: 'c', points: stairs(0)}, {from: 'b', to: 'c', points: stairs(1)}])), []);
});

test('edge-bends: a mean over the figure above 3 is reported; exactly 3 is not', () => {
  const edges = (n: number, count = 3) => Array.from({length: count}, (_, i) => ({from: `a${i}`, to: `b${i}`, points: stairs(n)}));
  const hit = bends(withEdges('states', edges(4)));
  assert.equal(hit.length, 1);
  assert.match(hit[0].message, /平均 4\.0 回/);
  assert.equal(hit[0].data?.threshold, 3);
  assert.deepEqual(bends(withEdges('states', edges(3))), []);
  assert.deepEqual(bends(withEdges('states', edges(3, 4))), []);
  assert.equal(bends(withEdges('states', [...edges(3), {from: 'x', to: 'y', points: stairs(4)}])).length, 1, 'mean 3.25');
});

test('edge-bends: warn only for layoutCheck: strict; accept turns it back into info', () => {
  const edges = [{from: 'a', to: 'b', points: stairs(6)}];
  assert.equal(bends(withEdges('bpmn', edges, {layoutCheck: 'strict'}))[0].severity, 'warn');
  assert.equal(bends(withEdges('bpmn', edges))[0].severity, 'info');
  const accepted = bends(withEdges('classes', edges, {layoutCheck: 'strict', accept: {'edge-bends': '依存が深い'}}))[0];
  assert.equal(accepted.severity, 'info');
  assert.match(accepted.message, /許容/);
});

test('edge-bends: self-loops, connect() lines and bands without routed edges are not counted', () => {
  assert.deepEqual(bends(withEdges('states', [{from: 'a', to: 'a', points: stairs(8)}])), []);
  const d = {...withEdges('states', []), connects: [{fromId: 'a', toId: 'b', points: stairs(9)} as unknown as LaidOutConnect]};
  assert.deepEqual(bends(d), []);
  assert.deepEqual(bends(withEdges('cause', [])), []);
  assert.deepEqual(bends(withBand({type: 'box', x: 0, y: 0, w: 10, h: 10})), []);
});

test('edge-bends: a band inside a row is read too, and each band is judged on its own', () => {
  const inner = (n: number) => ({type: 'cause', x: 0, y: 0, w: 10, h: 10, edges: [{from: 'a', to: 'b', points: stairs(n)}]});
  assert.equal(bends(withBand({type: 'row', x: 0, y: 0, w: 10, h: 10, children: [inner(6), inner(1)]})).length, 1);
});

// ---- real figures: the rule gets a route for every arrow, and what it reports matches the routes it was given -----------------------------

const net = [{id: 'a', label: 'A'}, {id: 'b', label: 'B'}, {id: 'c', label: 'C'}, {id: 'd', label: 'D'}];

test('semnet charts hand their arrows to the check (pert, dependency, causal loop), self-loops left out; a ring has none', async () => {
  const p = await checkDiagram(diagram({theme: 'blue', title: 't'}).add(pert([{id: 'a', label: 'A', duration: 2}, {id: 'b', label: 'B', duration: 3, predecessors: ['a']}, {id: 'c', label: 'C', duration: 1, predecessors: ['a', 'b']}])));
  const chart = p.laidOut.laidOut.find(b => b.type === 'chart');
  assert.ok(chart && chart.type === 'chart');
  assert.equal(chart.edges?.length, 3);
  for (const e of chart.edges ?? []) assert.ok(e.points.length >= 2 && Number.isFinite(bendsOf(e.points)));

  const dep = await checkDiagram(diagram({theme: 'blue', title: 't'}).add(dependencyNetwork(net, [{from: 'a', to: 'b', type: 'depends'}, {from: 'b', to: 'c', type: 'uses'}, {from: 'a', to: 'a', type: 'relates'}, {from: 'a', to: 'd', type: 'depends'}])));
  const dc = dep.laidOut.laidOut.find(b => b.type === 'chart');
  assert.ok(dc && dc.type === 'chart');
  assert.equal(dc.edges?.length, 3, 'the self-loop is not listed');

  const loop = await checkDiagram(diagram({theme: 'blue', title: 't'}).add(causalLoop(net.slice(0, 3), [{from: 'a', to: 'b', polarity: '+'}, {from: 'b', to: 'c', polarity: '+'}, {from: 'c', to: 'a', polarity: '-'}])));
  const lc = loop.laidOut.laidOut.find(b => b.type === 'chart');
  assert.ok(lc && lc.type === 'chart');
  assert.equal(lc.edges?.length, 3);

  const ring = await checkDiagram(diagram({theme: 'blue', title: 't'}).add(causalLoop(net.slice(0, 3), [{from: 'a', to: 'b', polarity: '+'}, {from: 'b', to: 'c', polarity: '+'}, {from: 'c', to: 'a', polarity: '-'}], {layout: 'ring'})));
  const rc = ring.laidOut.laidOut.find(b => b.type === 'chart');
  assert.ok(rc && rc.type === 'chart');
  assert.equal(rc.edges, undefined, 'curves are not counted');
});

test('on real cause / states figures the finding is exactly what the routes say', async () => {
  // a ladder of long arrows: every node points at every later one
  const ids = ['n0', 'n1', 'n2', 'n3', 'n4'];
  const links = ids.flatMap((a, i) => ids.slice(i + 1).map(b => ({from: a, to: b})));
  for (const band of [causeTree(ids.map(id => ({id, label: id})), links, {dir: 'right'}), stateDiagram(ids.map(id => ({id, label: id})), links, {dir: 'right'})]) {
    const r = await checkDiagram(diagram({theme: 'blue', title: 't'}).add(band));
    const laid = r.laidOut.laidOut.find(b => b.type === 'cause' || b.type === 'states');
    assert.ok(laid && (laid.type === 'cause' || laid.type === 'states'));
    const counts = laid.edges.filter(e => e.from !== e.to).map(e => bendsOf(e.points));
    const total = counts.reduce((a, b) => a + b, 0), expected = counts.some(n => n >= 5) || total / counts.length > 3;
    assert.equal(r.verdict.findings.filter(f => f.rule === 'edge-bends').length, expected ? 1 : 0, `${laid.type}: ${counts.join(',')}`);
    assert.ok(r.verdict.findings.filter(f => f.rule === 'edge-bends').every(f => f.severity === 'info'));
  }
});

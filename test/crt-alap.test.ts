// ADR 0070 D1 (U1): a CRT with no `layer` written moves its preconditions, and the chains they start, up to just before their targets;
// every other node keeps its asap layer. Checked on small figures and on the shape of the reported CRT (test/fixtures/crt-report-shape.ts).
// Nothing here fixes a size in px: layers are ranks of the box middles, and the reported figure is compared with its own asap layout.
import test from 'node:test';
import './helpers/strict-width.ts'; // a label the layout did not register for measuring throws instead of measuring 0 wide
import assert from 'node:assert/strict';
import {causeTree, checkDiagram, closeMeasurer, diagram, renderDiagram} from '../lib/dsl.ts';
import type {Diagram} from '../lib/dsl.ts';
import type {LaidOutCause} from '../lib/types/diagrams.ts';
import {bendsOf, simplify, type P} from '../lib/polyline-metrics.ts';
import {crtMovers} from '../lib/toc.ts';
import {CRT_REPORT_LINKS, CRT_REPORT_NODES, crtReportShape} from './fixtures/crt-report-shape.ts';

test.after(() => closeMeasurer());

const N = (id: string, extra: object = {}) => ({id, label: id, ...extra});
const laid = async (d: Diagram): Promise<LaidOutCause> => (await checkDiagram(d)).laidOut.laidOut.find(b => b.type === 'cause') as LaidOutCause;
/** Each node's layer, read as the rank of its box middle along the arrows (dir 'up': the first layer is the lowest row). Only for figures whose layers are not folded into rows. */
const layersOf = (t: LaidOutCause): Map<string, number> => {
  const mid = (i: number) => Math.round(t.nodes[i]!.y + t.nodes[i]!.h / 2); // middles: a root's double outline makes it taller than its layer's other boxes
  const rows = [...new Set(t.nodes.map((_, i) => mid(i)))].sort((a, b) => b - a);
  return new Map(t.anchors.map((a, i) => [a.id, rows.indexOf(mid(i))]));
};
/** The arrows the layout turned around (`breakCycles`), as from -> to. */
const reversedOf = (t: LaidOutCause): string[] => t.edges.filter(e => e.reversed).map(e => `${e.from}->${e.to}`).sort();
/** Pairs of runs of two different arrows on one axis, under `sep` apart and over 4px long together (ADR 0070 「並走」). */
const parallelPairs = (t: LaidOutCause, sep: number): number => {
  const runs = (pts: P[]) => { const s = simplify(pts); return s.slice(1).map((q, i) => ({p: s[i]!, q})); };
  let n = 0;
  t.edges.forEach((a, i) => t.edges.forEach((b, j) => {
    if (j <= i) return;
    for (const r of runs(a.points)) for (const s of runs(b.points)) {
      const rH = Math.abs(r.p.y - r.q.y) < 0.5;
      if (rH !== (Math.abs(s.p.y - s.q.y) < 0.5)) continue;
      const [c, d] = rH ? ['x', 'y'] as const : ['y', 'x'] as const;
      const along = Math.min(Math.max(r.p[c], r.q[c]), Math.max(s.p[c], s.q[c])) - Math.max(Math.min(r.p[c], r.q[c]), Math.min(s.p[c], s.q[c]));
      if (Math.abs(r.p[d] - s.p[d]) < sep && along > 4) n++;
    }
  }));
  return n;
};

test('crtMovers(): the preconditions and the chains that start only from them, on the links as written; a cycle never joins', () => {
  const nodes = [N('r', {role: 'root'}), N('pre', {role: 'precondition'}), N('c'), N('d'), N('mix'), N('p'), N('q'), N('u', {role: 'ude'})];
  const links = [{from: 'pre', to: 'c'}, {from: 'c', to: 'd'}, {from: ['pre', 'r'], to: 'mix'}, {from: 'p', to: 'q'}, {from: 'q', to: 'p', back: true as const}, {from: ['d', 'mix', 'q'], to: 'u'}];
  assert.deepEqual([...crtMovers({nodes, links})].sort(), ['c', 'd', 'pre'], 'mix has a root among its causes; p and q are on a cycle; u has causes outside');
  assert.deepEqual([...crtMovers({nodes: nodes.filter(n => n.id !== 'pre').map(n => ({...n})), links: links.filter(l => l.from !== 'pre' && !(Array.isArray(l.from) && l.from.includes('pre')))})], [], 'no precondition: nothing moves');
  // a node with no link into it and no role does not move (it is a cause's start that lacks its tag)
  assert.deepEqual([...crtMovers({nodes: [N('x'), N('u')], links: [{from: 'x', to: 'u'}]})], []);
});

test("causeTree({tree: 'crt'}): a precondition moves to its target's layer - 1; a root and an entry without a role keep layer 0; layer: 'alap' / 'asap' as written (ADR 0070 D1, ADR 0019 D1)", async () => {
  // r -> a -> b -> c -> u; pre -> c; x (no role, a root without its tag) -> c
  const nodes = [N('u', {role: 'ude'}), N('c'), N('b'), N('a'), N('r', {role: 'root'}), N('pre', {role: 'precondition'}), N('x')];
  const links = [{from: 'r', to: 'a'}, {from: 'a', to: 'b'}, {from: 'b', to: 'c'}, {from: 'c', to: 'u'}, {from: 'pre', to: 'c'}, {from: 'x', to: 'c'}];
  const layers = async (opts: object) => layersOf(await laid(diagram({theme: 'blue'}).add(causeTree(nodes, links, {dir: 'up', ...opts}))));
  const crt = await layers({tree: 'crt'}), asap = await layers({tree: 'crt', layer: 'asap'}), alap = await layers({tree: 'crt', layer: 'alap'}), none = await layers({});
  assert.equal(crt.get('pre'), crt.get('c')! - 1, 'the precondition sits just before its target');
  assert.equal(crt.get('r'), 0, 'the root stays on the first layer');
  assert.equal(crt.get('x'), 0, 'an entry without a role stays where asap puts it');
  assert.equal(asap.get('pre'), 0, "layer: 'asap' gives back the old picture");
  assert.deepEqual(none, asap, 'a cause tree with no tree written keeps the asap layers');
  assert.equal(alap.get('x'), alap.get('c')! - 1, "an explicit layer: 'alap' keeps ADR 0019's meaning: every entry but a root / injection / start moves");
  assert.equal(alap.get('pre'), alap.get('c')! - 1);
});

test("causeTree({tree: 'crt'}) with no precondition: the SVG is byte for byte the asap one", async () => {
  const nodes = [N('u1', {role: 'ude'}), N('u2', {role: 'ude'}), N('m'), N('x'), N('r', {role: 'root'})];
  const links = [{from: 'r', to: 'm'}, {from: 'm', to: 'u1'}, {from: ['m', 'x'], to: 'u2'}, {from: 'u2', to: 'm', back: true as const}];
  const svg = async (opts: object) => (await renderDiagram(diagram({theme: 'blue'}).add(causeTree(nodes, links, {tree: 'crt', dir: 'up', ...opts})), {name: 'c.svg', budget: 'cacheOnly'})).svg;
  assert.equal(await svg({}), await svg({layer: 'asap'}));
});

test("causeTree({tree: 'crt'}) with preconditions and a back: true loop: only the movers move, the cycle's nodes keep their asap layers, and the same links are turned around", async () => {
  // a loop r -> a -> b -> u -> a (back), and a cycle p <-> q that is no root's (cutting q -> p leaves p with no cause in the DAG)
  const nodes = [N('u', {role: 'ude'}), N('b'), N('a'), N('q'), N('p'), N('r', {role: 'root'}), N('pre', {role: 'precondition'}), N('c'), N('pre2', {role: 'precondition'})];
  const links = [{from: 'r', to: 'a'}, {from: 'a', to: 'b'}, {from: ['b', 'q'], to: 'u'}, {from: 'u', to: 'a', back: true as const},
    {from: 'p', to: 'q'}, {from: 'q', to: 'p', back: true as const}, {from: 'pre', to: 'c'}, {from: 'c', to: 'u'}, {from: 'pre2', to: 'b'}];
  const moves = crtMovers({nodes, links});
  assert.deepEqual([...moves].sort(), ['c', 'pre', 'pre2']);
  const at = async (opts: object) => laid(diagram({theme: 'blue'}).add(causeTree(nodes, links, {tree: 'crt', dir: 'up', ...opts})));
  const crt = await at({}), asap = await at({layer: 'asap'});
  const lc = layersOf(crt), la = layersOf(asap);
  for (const n of nodes) if (!moves.has(n.id)) assert.equal(lc.get(n.id), la.get(n.id), `${n.id} keeps its asap layer`);
  assert.equal(lc.get('c'), lc.get('u')! - 1, 'the chain from a precondition moves up to its target');
  assert.equal(lc.get('pre'), lc.get('c')! - 1);
  assert.equal(lc.get('pre2'), lc.get('b')! - 1);
  assert.ok(la.get('pre2')! < lc.get('pre2')!, 'pre2 did move');
  assert.deepEqual(reversedOf(crt), reversedOf(asap), 'the cycles are cut at the same links');
  assert.ok(reversedOf(crt).length >= 2, 'both loops are cut');
});

test('the reported CRT (U0 fixture): only the preconditions move, every other node keeps its asap layer', async () => {
  const moves = crtMovers({nodes: CRT_REPORT_NODES, links: CRT_REPORT_LINKS});
  assert.deepEqual([...moves].sort(), ['pre1', 'pre2', 'pre3', 'pre4']);
  // at the report's 2600px the asap first layer (10 boxes) folds into two rows; on a wider canvas each layer is one row, and the rows are the layers
  const crt = layersOf(await laid(crtReportShape({}, 3600))), asap = layersOf(await laid(crtReportShape({layer: 'asap'}, 3600)));
  for (const n of CRT_REPORT_NODES) if (!moves.has(n.id)) assert.equal(crt.get(n.id), asap.get(n.id), `${n.id} keeps its asap layer`);
  const targets = (id: string) => CRT_REPORT_LINKS.filter(l => (typeof l.from === 'string' ? [l.from] : l.from).includes(id)).map(l => must(crt.get(l.to)));
  for (const id of moves) assert.equal(crt.get(id), Math.min(...targets(id)) - 1, `${id} sits just before its nearest target`);
});

test('the reported CRT (U0 fixture), as reported: the bundles go away and no arrow bends more than 4 times by default', async () => {
  const crt = await laid(crtReportShape()), asap = await laid(crtReportShape({layer: 'asap'}));
  const bends = (t: LaidOutCause) => t.edges.map(e => bendsOf(e.points));
  // asap drew arrows on one line (the report) until the long arrows' turns got tracks (ADR 0070 U4a, test/crt-tracks.test.ts)
  assert.equal(parallelPairs(crt, 4), 0, 'no two arrows run under 4px apart');
  assert.ok(Math.max(...bends(crt)) <= 4, `the most bends of one arrow: ${Math.max(...bends(crt))}`);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  assert.ok(sum(bends(crt)) < sum(bends(asap)), `bends in all: ${sum(bends(crt))} (asap ${sum(bends(asap))})`);
  assert.deepEqual([crt.loose, asap.loose], [[], []], 'every AND keeps its arc');
});

function must<T>(v: T | undefined): T {
  if (v === undefined) throw new Error('missing');
  return v;
}

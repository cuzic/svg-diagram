// ADR 0075 D1/D2 (U1): the search for the order of the rows (lib/layer-order-search.ts) and the two hooks of layoutLayered it needs (`rowSearch`, `forceRows`).
import test from 'node:test';
import assert from 'node:assert/strict';
import {layerCrossings, searchLayerRows} from '../lib/layer-order-search.ts';
import {layoutLayered} from '../lib/graph-layout.ts';
import {causeTree, checkDiagram, closeMeasurer, diagram} from '../lib/dsl.ts';
import {searchStats} from '../lib/toc.ts';
import {randomCrts} from './helpers/random-crt.ts';
import './helpers/strict-width.ts';

test.after(() => closeMeasurer());

type Succ = Map<string, string[]>;
const D = (n: number, l: number): string => `\u0000d${n}.${l}`; // the name of a dummy node
const succOf = (links: [string, string][]): Succ => { const m: Succ = new Map(); for (const [a, b] of links) m.set(a, [...(m.get(a) ?? []), b]); return m; };
const noAnd = new Set<string>();
const flat = (_: string): number => 0;

test('the search finds an order with no crossing for two crossed links', () => {
  const rows = [['a', 'b'], ['c', 'd']], succ = succOf([['a', 'd'], ['b', 'c']]);
  assert.equal(layerCrossings(rows, succ, noAnd, true), 1);
  const r = searchLayerRows(rows, succ, flat, noAnd);
  assert.equal(layerCrossings(r.rows, succ, noAnd, true), 0);
  assert.equal(r.plainCrossings, 0);
});

test('the cost the search tracks move by move is the cost of the rows it returns (the swap differences are right)', () => {
  // a seeded random layered graph of 4 layers with 7 nodes each, with a few AND effects
  let seed = 20261122; const rnd = (): number => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const rows: string[][] = Array.from({length: 4}, (_, l) => Array.from({length: 7}, (_, k) => `n${l}.${k}`));
  const links: [string, string][] = [];
  for (let l = 0; l + 1 < 4; l++) for (const a of rows[l]!) for (let k = 0; k < 2; k++) links.push([a, rows[l + 1]![Math.floor(rnd() * 7)]!]);
  const succ = succOf(links), andTo = new Set(['n2.1', 'n3.4']);
  const seedCost = layerCrossings(rows, succ, andTo, false);
  const r = searchLayerRows(rows, succ, flat, andTo);
  assert.equal(r.cost, layerCrossings(r.rows, succ, andTo, false));
  assert.equal(r.plainCrossings, layerCrossings(r.rows, succ, noAnd, true));
  assert.ok(r.cost <= seedCost && r.cost < seedCost, `the search lowered the cost ${seedCost} -> ${r.cost}`);
  assert.ok(r.moves > 0 && r.moves <= 5 * 3000);
});

test('the search is deterministic: the same input, the same rows and moves', () => {
  const rows = [['a', 'b', 'c', 'd'], ['e', 'f', 'g', 'h']], succ = succOf([['a', 'h'], ['b', 'g'], ['c', 'f'], ['d', 'e'], ['a', 'e']]);
  assert.deepEqual(searchLayerRows(rows, succ, flat, noAnd), searchLayerRows(rows, succ, flat, noAnd));
});

test('rows with no crossing are returned as they are, with no annealing move (restart 0 is the order the sweeps left)', () => {
  const rows = [['a', 'b'], ['c', 'd']], r = searchLayerRows(rows, succOf([['a', 'c'], ['b', 'd']]), flat, noAnd);
  assert.deepEqual(r.rows, rows);
  assert.equal(r.moves, 0);
});

test('a node never leaves its connected component: every row keeps the components in order', () => {
  const rows = [['a1', 'a2', 'b1', 'b2'], ['c1', 'c2', 'e1', 'e2']], comp = (id: string): number => id.startsWith('a') || id.startsWith('c') ? 0 : 1;
  const r = searchLayerRows(rows, succOf([['a1', 'c2'], ['a2', 'c1'], ['b1', 'e2'], ['b2', 'e1']]), comp, noAnd);
  for (const row of r.rows) assert.deepEqual(row.map(comp), row.map(comp).toSorted((x, y) => x - y));
  assert.equal(r.plainCrossings, 0);
});

test('two links into one AND effect weigh 6, and two links out of one AND effect weigh 6; the same crossing elsewhere weighs 1 (both branches of the weight)', () => {
  // into: a -> d1 -> t2 and b -> d2 -> t2 cross in the middle layer
  const into = succOf([['a', D(1, 1)], ['b', D(2, 1)], [D(1, 1), 't2'], [D(2, 1), 't2']]), rowsIn = [['a', 'b'], [D(2, 1), D(1, 1)], ['t2']];
  assert.equal(layerCrossings(rowsIn, into, new Set(['t2']), false), 6);
  assert.equal(layerCrossings(rowsIn, into, noAnd, false), 1);
  // out of: t -> d1 -> p and t -> d2 -> q cross in the last layer
  const out = succOf([['t', D(1, 1)], ['t', D(2, 1)], [D(1, 1), 'p'], [D(2, 1), 'q']]), rowsOut = [['t'], [D(1, 1), D(2, 1)], ['q', 'p']];
  assert.equal(layerCrossings(rowsOut, out, new Set(['t']), false), 6);
  assert.equal(layerCrossings(rowsOut, out, noAnd, false), 1);
});

// ---- the two hooks of layoutLayered ----

const nodes = ['a', 'b', 'c', 'd'].map(id => ({id, size: {w: 40, h: 20}}));
const edges = [{from: 'a', to: 'c'}, {from: 'b', to: 'd'}];
const across = (lay: ReturnType<typeof layoutLayered>, id: string): number => lay.nodes.get(id)!.y;

test('forceRows puts the rows in place of the sweeps\' order when every layer holds the same nodes, and says so', () => {
  const plain = layoutLayered(nodes, edges, {dir: 'right'});
  assert.ok(across(plain, 'c') < across(plain, 'd'));
  const force = {rows: [['a', 'b'], ['d', 'c']]};
  const forced = layoutLayered(nodes, edges, {dir: 'right', forceRows: force});
  assert.equal((force as {took?: boolean}).took, true);
  assert.ok(across(forced, 'd') < across(forced, 'c'));
});

test('forceRows is refused (took false, the sweeps\' order is laid out) when a layer holds other nodes or the layer count differs', () => {
  const plain = layoutLayered(nodes, edges, {dir: 'right'});
  for (const rows of [[['a', 'b'], ['d']], [['a', 'c'], ['b', 'd']], [['a', 'b']]]) {
    const force: {rows: string[][]; took?: boolean} = {rows};
    const lay = layoutLayered(nodes, edges, {dir: 'right', forceRows: force});
    assert.equal(force.took, false);
    assert.deepEqual([...lay.nodes], [...plain.nodes]);
  }
});

test('rowSearch leaves the layout as it is and fills `result` once (the first call that has none); orderOnly does not search', () => {
  const plain = layoutLayered(nodes, edges, {dir: 'right'});
  const search: {andTo: ReadonlySet<string>; result?: ReturnType<typeof searchLayerRows>} = {andTo: noAnd};
  const lay = layoutLayered(nodes, edges, {dir: 'right', rowSearch: search});
  assert.deepEqual([...lay.nodes], [...plain.nodes]);
  const first = search.result;
  assert.ok(first && first.rows.length === 2);
  layoutLayered(nodes, [{from: 'a', to: 'd'}, {from: 'b', to: 'c'}], {dir: 'right', rowSearch: search});
  assert.equal(search.result, first);
  const only: {andTo: ReadonlySet<string>; result?: ReturnType<typeof searchLayerRows>} = {andTo: noAnd};
  layoutLayered(nodes, edges, {dir: 'right', orderOnly: true, rowSearch: only});
  assert.equal(only.result, undefined);
});

// ---- where the search runs ----

const figure = randomCrts(2)[1]!; // plain #1 crosses 7 times on main: the order search runs
const drawFigure = async (extra: Record<string, unknown>): Promise<void> => {
  await checkDiagram(diagram({theme: 'blue', width: 1800}).add(causeTree(figure.nodes, figure.links, {tree: 'crt', dir: figure.dir, ...extra}) as never));
};

test('a cause tree searches the rows; `straighten: false` does not search (the way back to the old figure)', async () => {
  searchStats.rowSearches = 0; searchStats.rowCandidates = 0;
  await drawFigure({});
  assert.ok(searchStats.rowSearches >= 1, 'the row search ran');
  searchStats.rowSearches = 0; searchStats.rowCandidates = 0;
  await drawFigure({straighten: false});
  assert.equal(searchStats.rowSearches, 0);
  assert.equal(searchStats.rowCandidates, 0);
});

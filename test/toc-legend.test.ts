import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {box, causeTree, checkDiagram, closeMeasurer, diagram, legend, renderDiagram} from '../lib/dsl.ts';
import type {LaidOutLegend} from '../lib/types/containers.ts';

test.after(() => closeMeasurer());

const N = (id: string, role?: string) => ({id, label: id, ...(role ? {role} : {})}) as {id: string; label: string; role?: never};
const frt = (opts: object = {}) => causeTree(
  [N('inj', 'injection'), N('fact', 'precondition'), N('mid'), N('de', 'de')],
  [{from: ['inj', 'fact'], to: 'mid'}, {from: 'mid', to: 'de'}], opts);
const items = async (...bands: unknown[]) => {
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue', legend: 'auto'}).add(...(bands as never[])));
  const l = laidOut.laidOut.find(b => b.type === 'legend') as LaidOutLegend | undefined;
  return {items: l?.items ?? [], verdict, laidOut};
};
const describe = (i: LaidOutLegend['items'][number]) => i.role ?? (i.edge ? `edge:${i.edge}` : i.mark ? `mark:${i.mark}` : '?');

test("legend: 'auto' with only a causeTree: the roles used and the AND arc, in the order of the entities; a plain entity gets none", async () => {
  const {items: it, verdict} = await items(frt());
  assert.deepEqual(it.map(describe), ['injection', 'precondition', 'de', 'edge:and']);
  assert.ok(it.every(i => i.label.length > 0));
  assert.deepEqual(verdict.problems, []);
});

test('legend: no AND, no core: no edge or mark entry; a role that is not used has no entry', async () => {
  const {items: it} = await items(causeTree([N('a', 'ude'), N('b')], [{from: 'b', to: 'a'}]));
  assert.deepEqual(it.map(describe), ['ude']);
});

test('legend: the core driver mark is listed when coreDriver marked an entity', async () => {
  const {items: it} = await items(causeTree([N('r', 'root'), N('u1', 'ude'), N('u2', 'ude')], [{from: 'r', to: 'u1'}, {from: 'r', to: 'u2'}], {coreDriver: true}));
  assert.deepEqual(it.map(describe), ['root', 'ude', 'mark:core']);
});

test('legend: a hand-written role item is not written twice; the rest are added to the same legend', async () => {
  const {items: it} = await items(frt(), legend([{role: 'injection', label: '打つ手'}]));
  assert.deepEqual(it.map(describe), ['injection', 'precondition', 'de', 'edge:and']);
  assert.equal(it[0].label, '打つ手');
});

test('legend: legendLabels overrides the label of a role', async () => {
  const {laidOut} = await checkDiagram(diagram({theme: 'blue', legend: 'auto', legendLabels: {'role:precondition': '与件'}}).add(frt()));
  const l = laidOut.laidOut.find(b => b.type === 'legend') as LaidOutLegend;
  assert.equal(l.items.find(i => i.role === 'precondition')!.label, '与件');
});

test("legend: legend-missing / legend-incomplete do not change for a causeTree without legend: 'auto'", async () => {
  const f = (await checkDiagram(diagram({theme: 'blue'}).add(frt()))).verdict.findings;
  assert.ok(!f.some(x => x.rule === 'legend-missing' || x.rule === 'legend-incomplete'));
  // a tone-coloured box still asks for its entry, exactly as before; the roles of the tree are not added to the message
  const g = (await checkDiagram(diagram({theme: 'blue'}).add(frt(), box({title: 'x', tone: 'danger'})))).verdict.findings.find(x => x.rule === 'legend-missing');
  assert.ok(g && !/role:|edge:and/.test(g.message));
});

test('legend: a diagram with no causeTree gets the same legend as before (roles are not read from other bands)', async () => {
  const {items: it} = await items(box({title: 'x', tone: 'danger'}));
  assert.deepEqual(it.map(i => i.tone), ['danger']);
});

test("legend: the SVG draws the role boxes (a double outline for a root, a hexagon for an obstacle) and the AND arc; verify passes", async () => {
  const d = diagram({theme: 'blue', legend: 'auto'}).add(causeTree([N('r', 'root'), N('o', 'obstacle'), N('x'), N('y')], [{from: ['r', 'o'], to: 'x'}, {from: 'x', to: 'y'}]));
  const svg = (await renderDiagram(d, {name: 'l.svg', budget: 'cacheOnly'})).svg;
  assert.ok(svg.includes('根本原因') && svg.includes('障害') && svg.includes('合わせて原因'));
  assert.equal(svg.match(/<polygon /g)?.length, 2, 'the obstacle: in the figure and in the legend');
});

test("legend: a back: true return and a blocks arrow each get an edge entry; none without them", async () => {
  const nodes = [N('r', 'root'), N('a'), N('u', 'ude'), N('fix', 'injection')];
  const links = [{from: 'r', to: 'a'}, {from: 'a', to: 'u'}];
  const {items: both} = await items(causeTree(nodes, [...links, {from: 'u', to: 'r', back: true}, {from: 'fix', to: 'u', kind: 'blocks'}]));
  assert.deepEqual(both.filter(i => i.edge).map(describe), ['edge:back', 'edge:blocks']);
  const {items: none} = await items(causeTree(nodes, links));
  assert.ok(!none.some(i => i.edge));
  const {items: hand} = await items(causeTree(nodes, [...links, {from: 'u', to: 'r', back: true}]), legend([{edge: 'back', label: '悪循環'}]));
  assert.equal(hand.filter(i => i.edge === 'back').length, 1);
});

test('legend: the SVG draws the blocks sample with a bar and no extra arrowhead, the back sample bold', async () => {
  const d = diagram({theme: 'blue'}).add(causeTree([N('a'), N('b')], [{from: 'a', to: 'b'}]), legend([{edge: 'blocks', label: '断つ'}, {edge: 'back', label: '戻り'}]));
  const svg = (await renderDiagram(d, {name: 'e.svg', budget: 'cacheOnly'})).svg;
  assert.equal(svg.match(/<path d="M[^"]* z" fill=/g)?.length, 2, 'the figure arrow and the back sample have a head; the blocks sample has none');
  assert.equal(svg.match(/stroke-width="3"/g)?.length, 2, 'the bar and the bold back line');
});

test('legend(): rejects an unknown role, edge or mark', () => {
  assert.throws(() => legend([{label: 'x', role: 'villain' as never}]), /has role villain/);
  assert.throws(() => legend([{label: 'x', edge: 'or' as never}]), /has edge or/);
  assert.throws(() => legend([{label: 'x', mark: 'big' as never}]), /has mark big/);
});

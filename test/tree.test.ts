import test from 'node:test';
import assert from 'node:assert/strict';
import {box, checkDiagram, closeMeasurer, connect, diagram, renderDiagram, tree} from '../lib/dsl.ts';
import type {LaidOutTree} from '../lib/types.ts';

test.after(() => closeMeasurer());

const org = () => tree({
  label: '本部', sub: '本部長', tone: 'accent',
  children: [{label: 'A部', id: 'a', children: [{label: 'a1'}, {label: 'a2'}]}, {label: 'B部', id: 'b'}],
});

const laid = async (...bands: unknown[]) => {
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue'}).add(...(bands as never[])));
  return {t: laidOut.laidOut.find(b => b.type === 'tree') as LaidOutTree, verdict};
};

test('tree() places every node, passes verify, and keeps nodes apart', async () => {
  const {t, verdict} = await laid(org());
  assert.deepEqual(verdict.problems, []);
  assert.equal(t.nodes.length, 5);
  assert.equal(t.edges.length, 4);
  for (let i = 0; i < t.nodes.length; i++) for (let j = i + 1; j < t.nodes.length; j++) {
    const a = t.nodes[i], b = t.nodes[j];
    assert.ok(!(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h), `nodes ${i} and ${j} overlap`);
  }
  for (const n of t.nodes) assert.ok(n.x >= t.x && n.x + n.w <= t.x + t.w);
});

test('tree() nodes with an id are anchors: connect() reaches them, a.anchors.<id> is a handle', async () => {
  const t = tree({label: 'r', children: [{label: 'x', id: 'x'}, {label: 'y', id: 'y'}]});
  assert.equal(t.anchors.x.id, 'x');
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue'}).add(t, box({id: 'ext', title: '外部システム'}), connect('x', 'ext', {route: 'elbow'})));
  assert.deepEqual(verdict.problems, []);
  assert.equal(laidOut.connects.length, 1);
});

test('tree() draws the nodes, the lines and the texts into the SVG', async () => {
  const {svg} = await renderDiagram(diagram({theme: 'blue'}).add(org()), {name: 't.svg', budget: 'cacheOnly'});
  assert.equal(svg.match(/<rect [^>]*rx="8"/g)?.length, 5);
  assert.match(svg, />本部長</);
  assert.match(svg, /font-weight="700"[^>]*>A部</);
});

test('tree() dir right makes a deep chain shorter than dir down does', async () => {
  const chain = {label: 'a', children: [{label: 'b', children: [{label: 'c', children: [{label: 'd'}]}]}]};
  const down = (await laid(tree(chain))).t, right = (await laid(tree(chain, {dir: 'right'}))).t;
  assert.ok(right.h < down.h);
});

test('tree() wraps a long label inside maxNodeW and rejects what cannot fit', async () => {
  const {t} = await laid(tree({label: 'とても長い部署の名前がここに入ります。これも折り返されます', children: [{label: 'x'}]}, {maxNodeW: 120}));
  assert.ok(t.nodes.every(n => n.w <= 120 + 14)); // a trailing 。 may hang past the width
  assert.ok(t.nodes[0].h > t.nodes[1].h);
  const wide = tree({label: 'r', children: Array.from({length: 12}, (_, i) => ({label: `部署${i}`}))});
  await assert.rejects(() => checkDiagram(diagram({theme: 'blue'}).add(wide)), /use dir: 'right'/);
});

test('tree() rejects bad input', async () => {
  assert.throws(() => tree({} as never), /needs a root node/);
  assert.throws(() => tree({label: 'r'}, {dir: 'up' as never}), /dir must be/);
  assert.throws(() => tree({label: 'r'}, {maxNodeW: 10}), /maxNodeW/);
  await assert.rejects(() => checkDiagram(diagram({theme: 'blue'}).add(tree({label: 'r', children: [{label: 'a', id: 'q'}, {label: 'b', id: 'q'}]}))), /duplicate node id "q"/);
  await assert.rejects(() => checkDiagram(diagram({theme: 'blue'}).add(tree({label: 'r', id: 'dup'}), box({id: 'dup', title: 'x'}))), /duplicate anchor id "dup"/);
});

test('tree() with reveal: a connector to one of its nodes appears with the figure, not before', async () => {
  const t = tree({label: 'r', children: [{label: 'x', id: 'x'}]}, {reveal: 2});
  const {laidOut} = await checkDiagram(diagram({theme: 'blue'}).add(t, box({id: 'ext', title: '外部', reveal: 2}), connect('x', 'ext', {route: 'elbow'})));
  assert.equal((laidOut.laidOut.find(b => b.type === 'tree') as LaidOutTree).reveal, 2);
  assert.equal(laidOut.connects[0].reveal, 2);
});

test('tree(): spotlight on a node id says to spotlight the figure; on the figure id it works', async () => {
  const t = (id?: string) => tree({label: 'r', children: [{label: 'x', id: 'x'}]}, id ? {id} : {});
  await assert.rejects(() => checkDiagram(diagram({theme: 'blue', spotlight: 'x'}).add(t())), /"x" is a node inside a figure/);
  const {laidOut} = await checkDiagram(diagram({theme: 'blue', spotlight: 'fig'}).add(t('fig'), box({id: 'other', title: 'ほか'})));
  assert.equal((laidOut.laidOut.find(b => b.type === 'tree') as LaidOutTree).dim, false);
});

test('tree(): a connector from outside that would cross a node is reported', async () => {
  const t = tree({label: 'r', children: [{label: 'A部', id: 'a'}, {label: 'B部', id: 'b'}, {label: 'C部', id: 'c'}]});
  const {verdict} = await checkDiagram(diagram({theme: 'blue'}).add(t, connect('a', 'c', {route: 'straight'})));
  assert.ok(verdict.problems.some(p => /B部|b\b|"b"/.test(p)), `a problem names the node in the way: ${JSON.stringify(verdict.problems)}`);
});

test('tree(): the muted sub line stays readable (4.5:1) on an accent node', async () => {
  const {svg} = await renderDiagram(diagram({theme: 'blue'}).add(tree({label: '本部', sub: '本部長', tone: 'accent'})), {name: 't.svg', budget: 'cacheOnly'});
  assert.match(svg, /fill="#22201b"[^>]*>本部長</);
});

// ---- mindmap() ----
import {mindmap} from '../lib/dsl.ts';

const map = () => mindmap({
  label: 'テーマ',
  children: [
    {label: 'P', id: 'p', children: [{label: 'p1'}, {label: 'p2'}]},
    {label: 'Q', id: 'q', children: [{label: 'q1'}]},
    {label: 'R', id: 'r'},
    {label: 'S', id: 's', children: [{label: 's1'}, {label: 's2'}, {label: 's3'}]},
  ],
});

test('mindmap() puts the root in the middle with branches on both sides, and passes verify', async () => {
  const {t, verdict} = await laid(map());
  assert.deepEqual(verdict.problems, []);
  assert.equal(t.nodes.length, 11);
  const root = t.nodes[0];
  assert.ok(t.nodes.some(n => n.x + n.w <= root.x) && t.nodes.some(n => n.x >= root.x + root.w));
  assert.ok(Math.abs((root.x + root.w / 2) - (t.x + t.w / 2)) < t.w * 0.35, 'the root is near the middle');
  assert.equal(t.edges.length, 10);
});

test('mindmap() sides pins a branch; bad sides are rejected', async () => {
  const {t} = await laid(mindmap({label: 'r', children: [{label: 'a', id: 'a'}, {label: 'b', id: 'b'}]}, {sides: {a: 'left', b: 'left'}}));
  const root = t.nodes[0];
  assert.ok(t.nodes.slice(1).every(n => n.x + n.w <= root.x));
  assert.throws(() => mindmap({label: 'r'}, {sides: {a: 'up' as never}}), /must be 'left' or 'right'/);
  await assert.rejects(() => checkDiagram(diagram({theme: 'blue'}).add(mindmap({label: 'r', children: [{label: 'a'}]}, {sides: {zz: 'left'}}))), /unknown node id "zz"/);
  await assert.rejects(() => checkDiagram(diagram({theme: 'blue'}).add(mindmap({label: 'r', children: [{label: 'a', children: [{label: 'b', id: 'deep'}]}]}, {sides: {deep: 'left'}}))), /only a child of the root/);
});

test('mindmap() nodes with an id are anchors for connect()', async () => {
  const m = map();
  assert.equal(m.anchors.p.id, 'p');
  const {verdict} = await checkDiagram(diagram({theme: 'blue'}).add(m));

test('tree(): a connector that ends on the whole figure (its id) is not stopped by the figure\'s own nodes', async () => {
  const t = tree({label: 'r', children: [{label: 'A部', id: 'a'}, {label: 'B部', id: 'b'}, {label: 'C部', id: 'c'}]}, {id: 'T'});
  const {verdict} = await checkDiagram(diagram({theme: 'blue'}).add(t, box({id: 'ext', title: '外部'}), connect('T', 'ext', {route: 'elbow'})));
  assert.deepEqual(verdict.problems, []);
});

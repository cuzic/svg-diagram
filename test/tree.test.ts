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

test('tree() dir right makes a figure that is taller than wide for a deep chain', async () => {
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

test('tree() with reveal appears at its step', () => {
  const t = tree({label: 'r'}, {reveal: 2});
  assert.equal(t.reveal, 2);
});

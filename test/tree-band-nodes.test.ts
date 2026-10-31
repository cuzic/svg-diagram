import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {box, chevron, checkDiagram, closeMeasurer, connect, diagram, mindmap, tree} from '../lib/dsl.ts';
import type {LaidOutTree} from '../lib/types/diagrams.ts';
import type {Band} from '../lib/types/index.ts';

test.after(() => closeMeasurer());

const steps = (ids: string[]) => chevron(ids.map(id => ({label: id, id})));
const laid = async (...bands: Band[]) => {
  const r = await checkDiagram(diagram({theme: 'blue', width: 940}).add(...(bands as never[])));
  return {r, t: r.laidOut.laidOut.find((b): b is LaidOutTree => b.type === 'tree')!};
};

test('tree band nodes: a band is laid out in its node rectangle and the tree joins the two rectangles', async () => {
  const {r, t} = await laid(tree({label: 'top', id: 'top', w: 800, band: steps(['a1', 'a2', 'a3']), children: [{label: 'sub', id: 'sub', w: 420, band: steps(['b1', 'b2'])}]}));
  assert.deepEqual(r.verdict.problems, []);
  const [top, sub] = [t.nodes[0]!, t.nodes[1]!];
  assert.equal(top.w, 800);
  assert.equal(sub.w, 420);
  assert.ok(top.band && sub.band);
  assert.ok(t.texts.length === 0 && t.labelBoxes.length === 0, 'the tree draws no text of its own for band nodes');
  const e = t.edges[0]!, [p, q] = [e.points[0]!, e.points[e.points.length - 1]!];
  assert.ok(Math.abs(p.y - (top.y + top.h)) < 0.5 && Math.abs(q.y - sub.y) < 0.5, 'the line runs from the parent bottom to the child top');
});

test('tree band nodes: the nodes sit on the grid, with the line ends moved with them', async () => {
  const {t} = await laid(tree({label: 'top', w: 800, band: steps(['a1', 'a2']), children: [{label: 'mid', w: 300, band: steps(['b1']), children: [{label: 'low', w: 200, band: steps(['c1'])}]}]}));
  for (const n of t.nodes) assert.equal(n.y % 4, 0, `y ${n.y}`);
  t.nodes.slice(0, -1).forEach((n, i) => {
    const next = t.nodes[i + 1]!, e = t.edges[i]!;
    assert.ok(Math.abs(e.points[0]!.y - (n.y + n.h)) < 0.5 && Math.abs(e.points[e.points.length - 1]!.y - next.y) < 0.5);
  });
});

test('tree band nodes: inner ids are anchors of the figure, so connect() can reach them (and the trial layout leaves no duplicate behind)', async () => {
  const bands = [tree({label: 'top', w: 800, band: steps(['a1', 'a2', 'a3']), children: [{label: 'sub', id: 'sub', w: 420, band: steps(['b1', 'b2'])}]}), connect('a2:bottom', 'b2:top')];
  const {r} = await laid(...bands); // (the line itself may brush a neighbouring chevron: only the ids are under test here)
  assert.equal(r.laidOut.connects.length, 1);
  assert.deepEqual(r.verdict.problems.filter(m => /unknown|duplicate/.test(m)), []);
});

test('tree band nodes: any band can be a node, next to ordinary text nodes; dir right and mindmap work too', async () => {
  const mixed = {label: 'root', children: [{label: 'plain'}, {label: 'boxed', w: 220, band: box({title: 'a box', body: 'inside a node'})}]};
  for (const make of [() => tree(mixed, {dir: 'right'}), () => tree(mixed), () => mindmap(mixed)]) {
    const {r, t} = await laid(make());
    assert.deepEqual(r.verdict.problems, []);
    assert.equal(t.nodes.filter(n => n.band).length, 1);
    assert.equal(t.labelBoxes.length, 2, 'the text nodes keep their label boxes');
  }
});

test('tree band nodes: mistakes throw', () => {
  const node = (n: object) => () => tree({label: 'r', children: [{label: 'n', ...n} as never]});
  assert.throws(node({band: steps(['x'])}), /needs its width/);
  assert.throws(node({band: steps(['x']), w: 20}), /needs its width/);
  assert.throws(node({band: steps(['x']), w: 300, sub: 'no'}), /no sub or tone/);
  assert.throws(node({band: steps(['x']), w: 300, tone: 'accent'}), /no sub or tone/);
  assert.throws(node({w: 300}), /only for a band node/);
  assert.throws(node({band: connect('a:bottom', 'b:top'), w: 300}), /connect cannot be a node/);
  assert.throws(node({band: 'chevron' as never, w: 300}), /must be a band/);
});

test('tree band nodes: a tree with no band node is laid out exactly as before', async () => {
  const {r, t} = await laid(tree({label: 'r', children: [{label: 'a'}, {label: 'b'}]}));
  assert.deepEqual(r.verdict.problems, []);
  assert.ok(t.nodes.every(n => n.band === undefined));
});

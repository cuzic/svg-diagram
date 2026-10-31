import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import {box, chevron, checkDiagram, closeMeasurer, connect, diagram, group, mindmap, tree} from '../lib/dsl.ts';
import type {LaidOutTree} from '../lib/types/diagrams.ts';
import type {Band} from '../lib/types/index.ts';

test.after(() => closeMeasurer());

const steps = (ids: string[]) => chevron(ids.map(id => ({label: id, id})));
const laid = async (...bands: Band[]) => {
  const r = await checkDiagram(diagram({theme: 'blue', width: 940}).add(...(bands as [Band])));
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

test('tree band nodes: inner ids are anchors of the figure, so connect() can reach them — also for the type checker (and the trial layout leaves no duplicate behind)', async () => {
  const t = tree({label: 'top', w: 800, band: steps(['a1', 'a2', 'a3']), children: [{label: 'sub', id: 'sub', w: 420, band: steps(['b1', 'b2'])}]});
  const r = await checkDiagram(diagram({theme: 'blue', width: 940}).add(t).connect('a2:bottom', 'b2:top')); // typed: a2 and b2 are declared by the bands inside the nodes
  assert.equal(r.laidOut.connects.length, 1); // (the line itself may brush a neighbouring chevron: only the ids are under test here)
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

test('tree band nodes: reveal of the tree reaches its bands, and a band inside a node can reveal later', async () => {
  const t = tree({label: 'top', w: 600, band: steps(['a1']), children: [{label: 'sub', w: 300, band: box({title: 'late', reveal: 3})}]}, {reveal: 2});
  const r = await checkDiagram(diagram({theme: 'blue', width: 940}).add(t));
  const stages = r.laidOut.laidOut.map(b => (b as {reveal?: number}).reveal);
  assert.ok(stages.includes(2), 'the first band comes with the tree');
  assert.ok(stages.includes(3), 'the box reveals at 3');
  assert.equal(r.laidOut.maxReveal, 3);
});

test('diagram defaults reach a band inside a node: connectDefaults on a labelled connect in a group node, as outside a tree', async () => {
  const make = () => group([box({title: 'x', id: 'x1'}), box({title: 'y', id: 'y1'}), connect('x1:bottom', 'y1:top', {label: 'to'})]);
  const outside = await checkDiagram(diagram({theme: 'blue', width: 940, connectDefaults: {chip: false}}).add(make()));
  const inside = await checkDiagram(diagram({theme: 'blue', width: 940, connectDefaults: {chip: false}}).add(tree({label: 'top', w: 500, band: make()})));
  assert.equal(outside.laidOut.connects[0]!.chip, false);
  assert.equal(inside.laidOut.connects[0]!.chip, outside.laidOut.connects[0]!.chip);
});

test('tree band nodes: one band object cannot be two nodes', () => {
  const one = steps(['q']);
  assert.throws(() => tree({label: 'r', w: 300, band: one, children: [{label: 'c', w: 300, band: one}]}), /already the band of another node/);
  assert.throws(() => tree({label: 'r', children: [{label: 'c', w: 300, band: [steps(['z'])] as never}]}), /swimlane\(\.\.\.\)\[0\]/);
});

test('tree band nodes: a brace and a two-point line follow a node that moves to the grid', async () => {
  const mixed = {label: 'root', sub: 'odd height', children: [{label: 'a', w: 220, band: box({title: 'one', body: 'x'})}, {label: 'b', w: 220, band: box({title: 'two'})}, {label: 'c'}]};
  const {t} = await laid(mindmap(mixed, {layout: 'brace'}));
  for (const n of t.nodes.filter(n => n.band)) assert.equal(n.y % 4, 0);
  for (const br of t.braces ?? []) {
    const ends = t.edges.flatMap(e => [e.points[0]!.y, e.points[e.points.length - 1]!.y]);
    assert.ok(ends.some(y => Math.abs(y - br.y1) < 3.5) && ends.some(y => Math.abs(y - br.y2) < 3.5), 'a brace end stays within a pixel or two of a line end');
  }
});

test('tree band nodes: a band that declares no id does not switch off the id check of the figure (types)', () => {
  const t = tree({label: 'r', id: 'r', w: 300, band: box({title: 'no id'})});
  const d = diagram({theme: 'blue', width: 940}).add(t);
  // @ts-expect-error 'nosuch' is declared by nothing: still a type error with a band node that has no ids
  d.connect('r', 'nosuch'); // (the figure is only laid out later: this line is checked by tsc, not at run time)
  assert.ok(d);
});

test('tree from: the line to a child leaves the named part of the parent band as a funnel; the other children keep their own line', async () => {
  const t = tree({label: 'top', w: 800, band: steps(['a1', 'a2', 'a3']), children: [
    {label: 'sub', w: 420, from: 'a2', band: steps(['b1', 'b2'])},
    {label: 'plain'},
  ]});
  const r = await checkDiagram(diagram({theme: 'blue', width: 940}).add(t));
  const p = r.laidOut.laidOut.find((b): b is LaidOutTree => b.type === 'tree')!;
  assert.deepEqual(r.verdict.problems, []);
  const sub = p.nodes[1]!, funnel = p.edges.filter(e => e.child === 1), other = p.edges.filter(e => e.child === 2);
  assert.equal(funnel.length, 2, 'two lines: the funnel');
  assert.equal(other.length, 1, 'the other child keeps its tree line');
  const [left, right] = funnel.map(e => [e.points[0]!, e.points[e.points.length - 1]!] as const);
  assert.ok(Math.abs(left![1].x - sub.x) < 0.5 && Math.abs(left![1].y - sub.y) < 0.5, 'the left line ends at the child top-left corner');
  assert.ok(Math.abs(right![1].x - (sub.x + sub.w)) < 0.5 && Math.abs(right![1].y - sub.y) < 0.5, 'the right line ends at the child top-right corner');
  assert.ok(left![0].x < right![0].x && Math.abs(left![0].y - right![0].y) < 0.5, 'both start on the bottom edge of the part, left then right');
  assert.ok(right![0].x - left![0].x < sub.w, 'from one step, narrower than the child band: a funnel that opens');
});

test('tree from: mistakes throw', async () => {
  assert.throws(() => tree({label: 'r', from: 'x', w: 300, band: steps(['x'])}), /root has no parent/);
  assert.throws(() => tree({label: 'r', children: [{label: 'c', from: 'x'}]}), /not a band node/);
  assert.throws(() => tree({label: 'r', w: 300, band: steps(['x']), children: [{label: 'c', from: 'x'}]}, {edges: false}), /edges: false/);
  assert.throws(() => mindmap({label: 'r', w: 300, band: steps(['x']), children: [{label: 'c', from: 'x'}]}, {edges: false}), /edges: false/);
  const bad = tree({label: 'r', w: 300, band: steps(['x1', 'x2']), children: [{label: 'c', from: 'nosuch', w: 200, band: steps(['y'])}]});
  await assert.rejects(checkDiagram(diagram({theme: 'blue', width: 940}).add(bad)), /not an id inside the band of "r" \(ids there: x1, x2\)/);
  const none = tree({label: 'r', w: 300, band: chevron([{label: 'no id'}]), children: [{label: 'c', from: 'x', w: 200, band: steps(['y'])}]});
  await assert.rejects(checkDiagram(diagram({theme: 'blue', width: 940}).add(none)), /declares no ids/);
});

test('tree edges: false draws none of the tree lines (tree and mindmap)', async () => {
  for (const make of [() => tree({label: 'r', children: [{label: 'a'}, {label: 'b'}]}, {edges: false}), () => mindmap({label: 'r', children: [{label: 'a'}, {label: 'b'}]}, {edges: false, layout: 'brace'})]) {
    const {r, t} = await laid(make());
    assert.deepEqual(r.verdict.problems, []);
    assert.equal(t.edges.length, 0);
    assert.equal(t.braces, undefined);
    assert.equal(t.nodes.length, 3);
  }
});

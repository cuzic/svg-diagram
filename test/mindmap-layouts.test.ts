import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/strict-width.ts'; // a label the layout did not register for measuring throws instead of measuring 0 wide
import {box, checkDiagram, closeMeasurer, connect, diagram, mindmap, renderDiagram} from '../lib/dsl.ts';
import type {LaidOutTree, MindmapLayout} from '../lib/types.ts';

test.after(() => closeMeasurer());

const topic = (extra: object = {}) => ({
  label: '新機能',
  children: [
    {label: '目的', id: 'p', children: [{label: '棚卸しを半分に', id: 'p1'}, {label: '欠品の防止', id: 'p2'}]},
    {label: '機能', id: 'q', children: [{label: 'バーコード', id: 'q1'}, {label: '発注アラート', id: 'q2'}, {label: 'CSV 出力', id: 'q3'}]},
    {label: '課題', id: 'r', children: [{label: '既存システム連携', id: 'r1'}]},
  ],
  ...extra,
});

const laid = async (layout: MindmapLayout, opts: object = {}) => {
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue'}).add(mindmap(topic(), {layout, ...opts})));
  const t = laidOut.laidOut.find(b => b.type === 'tree') as LaidOutTree;
  const at = (id: string) => t.nodes.find(n => n.id === id)!;
  const root = t.nodes[0];
  return {t, verdict, at, root};
};
const overlap = (a: {x: number; y: number; w: number; h: number}, b: {x: number; y: number; w: number; h: number}): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const LAYOUTS: MindmapLayout[] = ['radial', 'right', 'left', 'org', 'list', 'brace', 'fishbone', 'timeline'];

for (const layout of LAYOUTS) {
  test(`mindmap layout '${layout}': every node is placed, none overlap, verify passes, ids are anchors`, async () => {
    const {t, verdict} = await laid(layout);
    assert.deepEqual(verdict.problems, [], layout);
    assert.equal(t.nodes.length, 10);
    for (let i = 0; i < t.nodes.length; i++) for (let j = i + 1; j < t.nodes.length; j++) assert.ok(!overlap(t.nodes[i], t.nodes[j]), `${layout}: nodes ${i} and ${j} overlap`);
    for (const n of t.nodes) assert.ok(n.x >= t.x - 0.5 && n.x + n.w <= t.x + t.w + 0.5 && n.y >= t.y - 0.5 && n.y + n.h <= t.y + t.h + 0.5, `${layout}: a node is outside the figure`);
    const m = mindmap(topic(), {layout});
    assert.equal(m.anchors.q2.id, 'q2');
  });
}

test('mindmap layouts down / up are trees (a narrow one fits); right / left grow to one side only', async () => {
  const small = (layout: MindmapLayout) => checkDiagram(diagram({theme: 'blue'}).add(mindmap({label: 'r', children: [{label: 'a', id: 'a'}, {label: 'b', id: 'b'}]}, {layout})));
  const down = (await small('down')).laidOut.laidOut.find(b => b.type === 'tree') as LaidOutTree, up = (await small('up')).laidOut.laidOut.find(b => b.type === 'tree') as LaidOutTree;
  assert.ok(down.nodes[1].y > down.nodes[0].y + down.nodes[0].h && up.nodes[1].y + up.nodes[1].h < up.nodes[0].y);
  const right = await laid('right'), left = await laid('left');
  for (const id of ['p', 'q', 'r', 'p1', 'q3', 'r1']) {
    assert.ok(right.at(id).x >= right.root.x + right.root.w, `right: ${id} is to the right`);
    assert.ok(left.at(id).x + left.at(id).w <= left.root.x, `left: ${id} is to the left`);
  }
});

test('mindmap layout org: the root above one row of children, each with a list of its own below', async () => {
  const {at, root} = await laid('org');
  assert.ok(at('p').y > root.y + root.h && at('p').y === at('q').y && at('q').y === at('r').y);
  assert.ok(at('p').x < at('q').x && at('q').x < at('r').x);
  for (const [parent, kids] of [['p', ['p1', 'p2']], ['q', ['q1', 'q2', 'q3']]] as const) {
    let prev = at(parent);
    for (const k of kids) { assert.ok(at(k).y >= prev.y + prev.h && at(k).x > at(parent).x, `${k} hangs under ${parent}`); prev = at(k); }
  }
});

test('mindmap layout list: an outline — every node below the one before it, one indent per level', async () => {
  const {t, at, root} = await laid('list');
  const order = ['p', 'p1', 'p2', 'q', 'q1', 'q2', 'q3', 'r', 'r1'].map(id => at(id));
  let prev = root;
  for (const n of order) { assert.ok(n.y >= prev.y + prev.h, 'below the one before'); prev = n; }
  assert.ok(at('p').x > root.x && at('p1').x > at('p').x && at('p').x === at('q').x && at('p1').x === at('q1').x);
  assert.equal(t.edges.length, 9);
});

test('mindmap layout brace: one brace per parent that has children, spanning its children; the parent points at it', async () => {
  const {t, at, root} = await laid('brace');
  assert.equal(t.braces?.length, 3); // the root, 目的, 機能 (課題 has one child: a plain line, not a brace)
  const rootBrace = t.braces!.find(b => Math.abs(b.ymid - (root.y + root.h / 2)) < 0.5)!;
  assert.ok(rootBrace.y1 <= at('p').y + at('p').h / 2 + 0.5 && rootBrace.y2 >= at('r').y + at('r').h / 2 - 0.5);
  assert.ok(rootBrace.x > root.x + root.w && at('p').x > rootBrace.x);
});

test('mindmap layout fishbone: the root is the head on the right, categories alternate above and below the spine, causes hang left of their bone', async () => {
  const {t, at, root} = await laid('fishbone');
  const spineY = root.y + root.h / 2;
  assert.ok(t.nodes.filter(n => n !== root).every(n => n.x + n.w <= root.x + 0.5), 'nothing is right of the head');
  assert.ok(at('p').y + at('p').h <= spineY && at('q').y >= spineY && at('r').y + at('r').h <= spineY, 'p above, q below, r above');
  for (const [cat, kids] of [['p', ['p1', 'p2']], ['q', ['q1', 'q2', 'q3']]] as const) for (const k of kids) assert.ok(at(k).y !== at(cat).y && at(k).x < at(cat).x + at(cat).w + 120, `${k} hangs on the bone of ${cat}`);
  assert.ok(t.edges.some(e => e.bold), 'a spine');
  // the third level (small bones) hangs under its cause, indented away from the bone, and nothing overlaps; a fourth level hangs under that
  const deep = await checkDiagram(diagram({theme: 'blue'}).add(mindmap({label: 'r', children: [{label: 'a', children: [{label: 'b', id: 'b', children: [{label: 'c', id: 'c', children: [{label: 'd', id: 'd'}]}, {label: 'c2'}]}, {label: 'b2'}]}, {label: 'z', children: [{label: 'y', children: [{label: 'x'}]}]}]}, {layout: 'fishbone'})));
  assert.deepEqual(deep.verdict.problems, []);
  const tr = deep.laidOut.laidOut.find(b => b.type === 'tree') as LaidOutTree;
  const get = (id: string) => tr.nodes.find(n => n.id === id)!;
  assert.ok(get('c').y > get('b').y && get('c').x + get('c').w < get('b').x + get('b').w, 'c hangs under b, indented toward the tail');
  assert.ok(get('d').y > get('c').y && get('d').x + get('d').w < get('c').x + get('c').w, 'd hangs under c');
});

test('mindmap layout timeline: the root at the left end of an axis, children along it alternately above and below, lists growing away', async () => {
  const {t, at, root} = await laid('timeline');
  const axisY = root.y + root.h / 2;
  assert.ok(at('p').y + at('p').h <= axisY && at('q').y >= axisY && at('r').y + at('r').h <= axisY, 'p above, q below, r above');
  assert.ok(at('p').x > root.x + root.w && at('q').x > at('p').x && at('r').x > at('q').x);
  assert.ok(at('p1').y < at('p').y && at('q1').y > at('q').y, 'lists grow away from the axis');
  assert.ok(t.edges.some(e => e.bold), 'an axis');
});

test('mindmap edges: straight and curve change how a branch is drawn; the layouts they cannot style say so', async () => {
  const straight = await laid('radial', {edges: 'straight'}), curve = await laid('right', {edges: 'curve'});
  assert.ok(straight.t.edges.every(e => e.points.length === 2));
  assert.ok(curve.t.edges.every(e => e.curve === 'x' && e.points.length === 2));
  const {svg} = await renderDiagram(diagram({theme: 'blue'}).add(mindmap(topic(), {layout: 'right', edges: 'curve'})), {name: 'm.svg', budget: 'cacheOnly'});
  assert.match(svg, / C[\d.]+,[\d.]+ [\d.]+,[\d.]+ [\d.]+,[\d.]+/);
  await assert.rejects(() => laid('org', {edges: 'curve'}), /edges: 'curve' applies to the radial, right, left, down and up layouts/);
  await assert.rejects(() => laid('list', {sides: {p: 'left'}}), /sides applies to the radial layout/);
  assert.throws(() => mindmap({label: 'r'}, {layout: 'spiral' as never}), /layout must be/);
  assert.throws(() => mindmap({label: 'r'}, {edges: 'wavy' as never}), /edges must be/);
});

test('mindmap layouts: node ids come with the figure (reveal) and a connector to the whole figure is not stopped', async () => {
  for (const layout of LAYOUTS) {
    const m = mindmap(topic(), {layout, id: 'M', reveal: 2});
    const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue'}).add(m, box({id: 'ext', title: '外部', reveal: 2}), connect('M', 'ext', {route: 'elbow'})));
    assert.equal(laidOut.connects[0].reveal, 2, layout);
    assert.deepEqual(verdict.problems, [], layout);
  }
});

test('mindmap brace: a parent with one child gets a plain line, not a zero-height brace', async () => {
  const {t, at} = await laid('brace');
  const only = t.edges.find(e => e.points.length === 2 && Math.abs(e.points[1].x - at('r1').x) < 0.5)!;
  assert.ok(only && Math.abs(only.points[0].y - only.points[1].y) < 0.5, 'a straight line to the only child');
  assert.ok(t.braces!.every(b => b.y2 - b.y1 > 8), 'every brace has some height');
});

test('mindmap fishbone: categories in one row never overlap, whatever causes they have (a category with none, a wide one); the root alone fits', async () => {
  const one = (children: object[]) => checkDiagram(diagram({theme: 'blue'}).add(mindmap({label: 'テーマ', children} as never, {layout: 'fishbone'})));
  const cases = [
    [{label: 'A', children: [{label: 'a1'}, {label: 'a2'}]}, {label: 'B', children: [{label: 'b1'}]}, {label: 'C'}],
    [{label: 'とても幅の広いカテゴリの名前'}, {label: 'B', children: [{label: '原因'}]}, {label: 'とても幅の広いカテゴリの名前その二'}, {label: 'D'}],
    [{label: 'A'}, {label: 'B'}, {label: 'C'}, {label: 'D'}, {label: 'E'}],
  ];
  for (const [i, c] of cases.entries()) {
    const {laidOut, verdict} = await one(c);
    assert.deepEqual(verdict.problems, [], `case ${i}`);
    const t = laidOut.laidOut.find(b => b.type === 'tree') as LaidOutTree;
    for (let a = 0; a < t.nodes.length; a++) for (let b = a + 1; b < t.nodes.length; b++) assert.ok(!overlap(t.nodes[a], t.nodes[b]), `case ${i}: ${a} and ${b} overlap`);
  }
  const {laidOut, verdict} = await one([]);
  const t = laidOut.laidOut.find(b => b.type === 'tree') as LaidOutTree;
  assert.deepEqual(verdict.problems, []);
  assert.ok(t.nodes[0].y >= t.y - 0.5 && t.nodes[0].y + t.nodes[0].h <= t.y + t.h + 0.5, 'the lone head is inside the figure');
});

test('mindmap fishbone: a bone leaves the middle of its category, even a wide one with no causes', async () => {
  const {laidOut} = await checkDiagram(diagram({theme: 'blue'}).add(mindmap({label: 'テーマ', children: [{label: 'とても幅の広いカテゴリの名前'}, {label: 'B', children: [{label: 'b1'}]}]}, {layout: 'fishbone'})));
  const t = laidOut.laidOut.find(b => b.type === 'tree') as LaidOutTree;
  const cat = t.nodes[1], bone = t.edges.find(e => e.points.length === 2 && Math.abs(e.points[0].y - (cat.y + cat.h)) < 0.5)!;
  assert.ok(Math.abs(bone.points[0].x - (cat.x + cat.w / 2)) < 0.5, 'the bone starts at the middle of the category');
});

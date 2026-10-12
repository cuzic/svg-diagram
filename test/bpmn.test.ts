import test from 'node:test';
import assert from 'node:assert/strict';
import {bpmn, box, checkDiagram, closeMeasurer, connect, diagram, renderDiagram} from '../lib/dsl.ts';
import type {LaidOutBpmn} from '../lib/types.ts';

test.after(() => closeMeasurer());

const flow = () => bpmn(
  [{id: 'a', label: '顧客'}, {id: 'b', label: '店舗'}, {id: 'c', label: '倉庫'}],
  [
    {id: 's', lane: 'a', kind: 'start', label: '注文'}, {id: 'chk', lane: 'b', label: '在庫を確認'}, {id: 'g', lane: 'b', kind: 'xor', label: '在庫'},
    {id: 'ship', lane: 'c', label: '出荷'}, {id: 'sorry', lane: 'b', label: '連絡'}, {id: 'e1', lane: 'a', kind: 'end'}, {id: 'e2', lane: 'a', kind: 'end'},
  ],
  [
    {from: 's', to: 'chk'}, {from: 'chk', to: 'g'}, {from: 'g', to: 'ship', label: 'あり'}, {from: 'g', to: 'sorry', label: 'なし'},
    {from: 'ship', to: 'e1', line: 'dashed'}, {from: 'sorry', to: 'e2', line: 'dashed'},
  ],
);

const laid = async (...bands: unknown[]) => {
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue'}).add(...(bands as never[])));
  return {t: laidOut.laidOut.find(b => b.type === 'bpmn') as LaidOutBpmn, verdict};
};
const overlap = (a: {x: number; y: number; w: number; h: number}, b: {x: number; y: number; w: number; h: number}): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('bpmn(): lanes stack, nodes sit in their lane, columns follow the flow, verify passes', async () => {
  const {t, verdict} = await laid(flow());
  assert.deepEqual(verdict.problems, []);
  assert.equal(t.lanes.length, 3);
  assert.ok(t.lanes[0].y < t.lanes[1].y && t.lanes[1].y < t.lanes[2].y);
  const by = (id: string) => t.anchors.find(a => a.id === id)!;
  const lane = (id: string) => t.lanes.findIndex(l => by(id).y >= l.y && by(id).y + by(id).h <= l.y + l.h);
  assert.deepEqual(['s', 'chk', 'ship', 'e1'].map(lane), [0, 1, 2, 0]);
  assert.ok(by('s').x < by('chk').x && by('chk').x < by('g').x && by('g').x < by('ship').x);
  for (let i = 0; i < t.nodes.length; i++) for (let j = i + 1; j < t.nodes.length; j++) assert.ok(!overlap(t.nodes[i], t.nodes[j]));
  assert.equal(t.nodes.find((_, i) => t.anchors[i].id === 'g')!.kind, 'xor');
});

test('bpmn(): flows start at their tail, end on their head, message flows are dashed', async () => {
  const {t} = await laid(flow());
  const by = (id: string) => t.anchors.find(a => a.id === id)!;
  const on = (p: {x: number; y: number}, r: {x: number; y: number; w: number; h: number}): boolean => p.x >= r.x - 0.5 && p.x <= r.x + r.w + 0.5 && p.y >= r.y - 0.5 && p.y <= r.y + r.h + 0.5;
  for (const e of t.edges) { assert.ok(on(e.points[0], by(e.from)), `${e.from} -> ${e.to} starts on ${e.from}`); assert.ok(on(e.points[e.points.length - 1], by(e.to)), `${e.from} -> ${e.to} ends on ${e.to}`); }
  assert.equal(t.edges.find(e => e.from === 'ship')!.line, 'dashed');
  assert.equal(t.edges.find(e => e.from === 's')!.line, 'solid');
  assert.deepEqual(t.labels.map(l => l.text).sort(), ['あり', 'なし']);
});

test('bpmn(): a flow back to an earlier node goes under the nodes and still passes verify', async () => {
  const {t, verdict} = await laid(bpmn([{id: 'a', label: '担当'}], [{id: 'x', lane: 'a', label: '作成'}, {id: 'y', lane: 'a', label: '確認'}, {id: 'g', lane: 'a', kind: 'xor'}], [{from: 'x', to: 'y'}, {from: 'y', to: 'g'}, {from: 'g', to: 'x', label: '差し戻し'}]));
  assert.deepEqual(verdict.problems, []);
  const back = t.edges.find(e => e.from === 'g' && e.to === 'x')!;
  assert.ok(back.points.length >= 3);
});

test('bpmn() SVG: lanes, circles (thick end), diamond with a cross, dashed message flow', async () => {
  const {svg} = await renderDiagram(diagram({theme: 'blue'}).add(flow()), {name: 'b.svg', budget: 'cacheOnly'});
  assert.equal(svg.match(/<circle /g)?.length, 3);
  assert.match(svg, /stroke-width="5"/);
  assert.match(svg, /stroke-dasharray="6,4"/);
  assert.match(svg, />顧客</);
});

test('bpmn() nodes are anchors for connect()', async () => {
  const b = flow();
  assert.equal(b.anchors.chk.id, 'chk');
  const {verdict} = await checkDiagram(diagram({theme: 'blue'}).add(b, box({id: 'doc', title: '手順書'}), connect('chk', 'doc', {route: 'elbow'})));
  assert.deepEqual(verdict.problems.filter(p => !/crosses|connector|runs through/.test(p)), []);
});

test('bpmn() rejects bad input', async () => {
  assert.throws(() => bpmn([], [{id: 'a', lane: 'x'}], []), /at least one lane/);
  assert.throws(() => bpmn([{id: 'x', label: 'L'}], [], []), /at least one node/);
  assert.throws(() => bpmn([{id: 'x', label: 'L'}], [{id: 'a', lane: 'x', label: 't'}], [{from: 'a', to: 'a', line: 'dotted' as never}]), /has line/);
  const bad = (lanes: object[], nodes: object[], flows: object[]) => checkDiagram(diagram({theme: 'blue'}).add(bpmn(lanes as never, nodes as never, flows as never)));
  const L = [{id: 'x', label: 'L'}];
  await assert.rejects(() => bad(L, [{id: 'a', lane: 'zz', label: 't'}], []), /unknown lane "zz"/);
  await assert.rejects(() => bad(L, [{id: 'a', lane: 'x', label: 't'}, {id: 'a', lane: 'x', label: 'u'}], []), /duplicate node id "a"/);
  await assert.rejects(() => bad(L, [{id: 'a', lane: 'x'}], []), /task "a" needs a label/);
  await assert.rejects(() => bad(L, [{id: 'a', lane: 'x', label: 't', kind: 'timer'}], []), /has kind timer/);
  await assert.rejects(() => bad(L, [{id: 'a', lane: 'x', label: 't'}], [{from: 'a', to: 'q'}]), /unknown node "q"/);
});

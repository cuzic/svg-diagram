import test from 'node:test';
import './helpers/strict-width.ts'; // a label the layout did not register for measuring throws instead of measuring 0 wide
import assert from 'node:assert/strict';
import {bpmn, box, checkDiagram, closeMeasurer, connect, diagram, renderDiagram} from '../lib/dsl.ts';
import {layoutSwimlaneAutoVertical} from '../lib/layout-swimlane-auto-vertical.ts';
import {checkSwimlaneAutoInput, isEvent, isGate, lineH, measureSwimlaneAutoNodes, nodePart} from '../lib/layout-swimlane-auto.ts';
import {ROLES} from '../lib/tokens.ts';
import {must} from '../lib/must.ts';
import type {LaidOutBpmn} from '../lib/types/diagrams.ts';

test.after(() => closeMeasurer());

const flow = (opts: {fit?: 'shrink'} = {}) => bpmn(
  [{id: 'a', label: '顧客'}, {id: 'b', label: '店舗'}, {id: 'c', label: '倉庫'}],
  [
    {id: 's', lane: 'a', kind: 'start', label: '注文'}, {id: 'chk', lane: 'b', label: '在庫を確認'}, {id: 'g', lane: 'b', kind: 'xor', label: '在庫'},
    {id: 'ship', lane: 'c', label: '出荷'}, {id: 'sorry', lane: 'b', label: '連絡'}, {id: 'e1', lane: 'a', kind: 'end'}, {id: 'e2', lane: 'a', kind: 'end'},
  ],
  [
    {from: 's', to: 'chk'}, {from: 'chk', to: 'g'}, {from: 'g', to: 'ship', label: 'あり'}, {from: 'g', to: 'sorry', label: 'なし'},
    {from: 'ship', to: 'e1', line: 'dashed'}, {from: 'sorry', to: 'e2', line: 'dashed'},
  ],
  opts,
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
  assert.ok(t.lanes[0]!.y < t.lanes[1]!.y && t.lanes[1]!.y < t.lanes[2]!.y);
  const by = (id: string) => t.anchors.find(a => a.id === id)!;
  const lane = (id: string) => t.lanes.findIndex(l => by(id).y >= l.y && by(id).y + by(id).h <= l.y + l.h);
  assert.deepEqual(['s', 'chk', 'ship', 'e1'].map(lane), [0, 1, 2, 0]);
  assert.ok(by('s').x < by('chk').x && by('chk').x < by('g').x && by('g').x < by('ship').x);
  for (let i = 0; i < t.nodes.length; i++) for (let j = i + 1; j < t.nodes.length; j++) assert.ok(!overlap(t.nodes[i]!, t.nodes[j]!));
  assert.equal(t.nodes.find((_, i) => t.anchors[i]!.id === 'g')!.kind, 'xor');
});

test('bpmn(): flows start at their tail, end on their head, message flows are dashed', async () => {
  const {t} = await laid(flow());
  const by = (id: string) => t.anchors.find(a => a.id === id)!;
  const on = (p: {x: number; y: number}, r: {x: number; y: number; w: number; h: number}): boolean => p.x >= r.x - 0.5 && p.x <= r.x + r.w + 0.5 && p.y >= r.y - 0.5 && p.y <= r.y + r.h + 0.5;
  for (const e of t.edges) { assert.ok(on(e.points[0]!, by(e.from)), `${e.from} -> ${e.to} starts on ${e.from}`); assert.ok(on(e.points[e.points.length - 1]!, by(e.to)), `${e.from} -> ${e.to} ends on ${e.to}`); }
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

test('bpmn(): a flow back from a task does not drop through an event under it in the same column', async () => {
  const {t, verdict} = await laid(bpmn(
    [{id: 'a', label: '営業'}, {id: 'b', label: '事務'}, {id: 'c', label: '経理'}],
    [
      {id: 's', lane: 'a', kind: 'start', label: '依頼'}, {id: 'n2', lane: 'b', label: '見積書を作成'}, {id: 'n7', lane: 'c', label: '請求・入金確認'},
      {id: 'x2', lane: 'c', kind: 'xor', label: '可否'}, {id: 'n11', lane: 'a', label: 'お客様に入金確認'}, {id: 'done', lane: 'c', kind: 'end', label: '完了'},
    ],
    [
      {from: 's', to: 'n2', line: 'dashed'}, {from: 'n2', to: 'n7', line: 'dashed'}, {from: 'n7', to: 'x2'},
      {from: 'x2', to: 'done', label: 'あり'}, {from: 'x2', to: 'n11', line: 'dashed', label: 'なし'}, {from: 'n11', to: 'n7', line: 'dashed'},
    ],
    {fit: 'shrink'},
  ));
  assert.deepEqual(verdict.problems.filter(p => p.includes('runs through')), []);
  const done = t.anchors.find(a => a.id === 'done')!, back = t.edges.find(e => e.from === 'n11' && e.to === 'n7')!;
  const a11 = t.anchors.find(a => a.id === 'n11')!, a7 = t.anchors.find(a => a.id === 'n7')!;
  assert.equal(back.points[0]!.y, a11.y + a11.h, 'leaves the bottom of the upper task');
  assert.equal(back.points[back.points.length - 1]!.y, a7.y, 'enters the top of the lower task');
  for (let i = 1; i < back.points.length; i++) {
    const p = back.points[i - 1]!, q = back.points[i]!;
    assert.ok(!(Math.min(p.x, q.x) < done.x + done.w && Math.max(p.x, q.x) > done.x && Math.min(p.y, q.y) < done.y + done.h && Math.max(p.y, q.y) > done.y), 'the back flow stays clear of the end event');
  }
});

const quote = (opts: {dir?: 'h' | 'v'} = {dir: 'v'}) => bpmn(
  [{id: 'cust', label: 'お客様'}, {id: 'sales', label: '営業'}, {id: 'office', label: '事務'}, {id: 'acc', label: '経理'}],
  [
    {id: 'req', lane: 'cust', kind: 'start', label: '見積を依頼'}, {id: 'quote', lane: 'office', label: '見積書作成'}, {id: 'check', lane: 'sales', label: '内容を確認'},
    {id: 'ok', lane: 'sales', kind: 'xor', label: '適切か'}, {id: 'reply', lane: 'sales', label: 'お客様へ返信'}, {id: 'won', lane: 'sales', kind: 'xor', label: '受注するか'},
    {id: 'lost', lane: 'sales', kind: 'end', label: '終了'}, {id: 'ledger', lane: 'office', label: '受注台帳に入力'}, {id: 'bill', lane: 'acc', label: '請求書発送'},
    {id: 'paid', lane: 'acc', kind: 'xor', label: '入金確認'}, {id: 'done', lane: 'acc', kind: 'end', label: '完了'}, {id: 'chase', lane: 'sales', label: '督促'},
  ],
  [
    {from: 'req', to: 'quote', line: 'dashed'}, {from: 'quote', to: 'check', line: 'dashed'}, {from: 'check', to: 'ok'}, {from: 'ok', to: 'reply', label: '問題なし'},
    {from: 'ok', to: 'quote', line: 'dashed', label: '要修正'}, {from: 'reply', to: 'won'}, {from: 'won', to: 'ledger', line: 'dashed', label: '受注'}, {from: 'won', to: 'lost', label: '失注'},
    {from: 'ledger', to: 'bill', line: 'dashed'}, {from: 'bill', to: 'paid'}, {from: 'paid', to: 'done', label: '入金あり'}, {from: 'paid', to: 'chase', line: 'dashed', label: '入金なし'},
    {from: 'chase', to: 'paid', line: 'dashed'},
  ],
  opts,
);
const runsOf = (pts: {x: number; y: number}[]) => pts.slice(1).map((q, i) => ({a: pts[i]!, b: q})).filter(({a, b}) => a.x !== b.x || a.y !== b.y);

test("bpmn({dir: 'v'}): lanes are columns under a header, rows follow the flow, verify passes", async () => {
  const {t, verdict} = await laid(quote());
  assert.deepEqual(verdict.problems, []);
  assert.equal(t.dir, 'v');
  assert.equal(t.lanes.length, 4);
  assert.ok(t.lanes.every((l, i) => l.labelW === 0 && l.labelH! > 0 && (i === 0 || l.x > t.lanes[i - 1]!.x)));
  const by = (id: string) => t.anchors.find(a => a.id === id)!;
  const lane = (id: string) => t.lanes.findIndex(l => by(id).x >= l.x && by(id).x + by(id).w <= l.x + l.w);
  assert.deepEqual(['req', 'check', 'quote', 'paid'].map(lane), [0, 1, 2, 3]);
  assert.ok(by('req').y < by('quote').y && by('check').y < by('ok').y && by('ok').y < by('reply').y && by('bill').y < by('paid').y);
  for (const a of t.anchors) assert.ok(a.y >= t.lanes[0]!.y + t.lanes[0]!.labelH!, `${a.id} is below the lane header`);
  assert.ok(t.lanes.every(l => l.x % 4 === 0 && l.w % 4 === 0), 'lane borders sit on the 4px grid');
});

test("bpmn({dir: 'v'}): no two flows share a run, a back flow enters from the side, a branch leaves its own vertex", async () => {
  const {t} = await laid(quote());
  const flows = t.edges.map(e => ({e, runs: runsOf(e.points)}));
  for (let i = 0; i < flows.length; i++) for (let j = i + 1; j < flows.length; j++) for (const p of flows[i]!.runs) for (const q of flows[j]!.runs) {
    const vertical = p.a.x === p.b.x && q.a.x === q.b.x && Math.abs(p.a.x - q.a.x) < 5 && Math.min(Math.max(p.a.y, p.b.y), Math.max(q.a.y, q.b.y)) - Math.max(Math.min(p.a.y, p.b.y), Math.min(q.a.y, q.b.y)) > 1;
    const horizontal = p.a.y === p.b.y && q.a.y === q.b.y && Math.abs(p.a.y - q.a.y) < 5 && Math.min(Math.max(p.a.x, p.b.x), Math.max(q.a.x, q.b.x)) - Math.max(Math.min(p.a.x, p.b.x), Math.min(q.a.x, q.b.x)) > 1;
    assert.ok(!vertical && !horizontal, `${flows[i]!.e.from} -> ${flows[i]!.e.to} and ${flows[j]!.e.from} -> ${flows[j]!.e.to} run on one line`);
  }
  const back = t.edges.find(e => e.from === 'chase' && e.to === 'paid')!, last = back.points.slice(-2);
  assert.equal(last[0]!.y, last[1]!.y, 'the loop back to the gateway ends level (into a side vertex)');
  const starts = t.edges.filter(e => e.from === 'won').map(e => `${e.points[0]!.x},${e.points[0]!.y}`);
  assert.equal(new Set(starts).size, 2, 'the two branches of a gateway leave from two vertices');
});

test("bpmn({dir: 'v'}): the default stays horizontal; a bad dir, fit with dir 'v', or too many lanes throws", async () => {
  const {t} = await laid(flow());
  assert.equal(t.dir, undefined);
  assert.throws(() => bpmn([{id: 'a', label: 'A'}], [{id: 'n', lane: 'a', label: 'N'}], [], {dir: 'x' as never}), /dir must be 'h' or 'v'/);
  assert.throws(() => bpmn([{id: 'a', label: 'A'}], [{id: 'n', lane: 'a', label: 'N'}], [], {dir: 'v', fit: 'shrink'}), /fit: 'shrink' is for the horizontal/);
  await assert.rejects(laid(bpmn(Array.from({length: 9}, (_, i) => ({id: `l${i}`, label: `L${i}`})), [{id: 'n', lane: 'l0', label: 'N'}], [], {dir: 'v'})), /too narrow for a task/);
  assert.equal(typeof layoutSwimlaneAutoVertical, 'function');
});

test('checkSwimlaneAutoInput / measureSwimlaneAutoNodes: the checks and sizes both directions share', () => {
  const b = bpmn([{id: 'a', label: '担当'}], [{id: 's', lane: 'a', kind: 'start', label: '開始'}, {id: 'g', lane: 'a', kind: 'xor', label: '分岐'}, {id: 't', lane: 'a', label: 'タスク'}], [{from: 's', to: 't'}, {from: 't', to: 'g'}]);
  const {laneIdx, kindOf} = checkSwimlaneAutoInput(b);
  assert.deepEqual([...laneIdx], [['a', 0]]);
  assert.deepEqual([...kindOf.values()], ['start', 'xor', 'task']);
  assert.throws(() => checkSwimlaneAutoInput({...b, nodes: [{id: 'x', lane: 'nope', label: 'X'}]}), /unknown lane "nope"/);
  assert.throws(() => checkSwimlaneAutoInput({...b, flows: [{from: 't', to: 's'}]}), /start event takes no flow into it/);
  const m = measureSwimlaneAutoNodes(b, kindOf, 168, (a, size) => a.length * size * 0.5, ROLES, {wrap: 'bunsetsu', keepWords: false});
  assert.deepEqual([m.get('s')!.w, m.get('g')!.w], [36, 44]);
  assert.ok(m.get('t')!.w <= 168 && m.get('t')!.lines);
  assert.ok(isGate('xor') && isGate('and') && isGate('or') && !isGate('task') && !isGate('end'));
  assert.ok(isEvent('start') && isEvent('end') && !isEvent('task') && !isEvent('xor'));
  assert.deepEqual(['t', 's', 'g'].map(id => nodePart(id, must(kindOf.get(id)), id).split(':')[0]), ['task', 'event', 'gateway']);
  assert.equal(lineH(14), 20);
});

test("bpmn({dir: 'v'}): focus and the parts of ADR 0054 reach the lanes, the nodes and every text", async () => {
  const {t, verdict} = await laid(bpmn([{id: 'a', label: '受付'}, {id: 'b', label: '審査'}],
    [{id: 's', lane: 'a', kind: 'start', label: '申込'}, {id: 'chk', lane: 'b', label: '書類を確認'}, {id: 'g', lane: 'b', kind: 'xor', label: '可否'}, {id: 'e', lane: 'a', kind: 'end', label: '通知'}],
    [{from: 's', to: 'chk'}, {from: 'chk', to: 'g'}, {from: 'g', to: 'e', label: '可'}], {dir: 'v', focus: 'g'}));
  assert.deepEqual(verdict.problems, []);
  assert.deepEqual(t.focused, ['g']);
  assert.ok(t.lanes.every(l => l.part?.startsWith('lane:')), 'every lane has its part');
  assert.deepEqual(t.nodes.map(n => n.part?.split(':')[0]), ['event', 'task', 'gateway', 'event']);
  assert.ok(t.texts.every(x => x.part), `every text has a part: ${t.texts.filter(x => !x.part).map(x => x.text).join(', ')}`);
  for (const name of ['受付', '書類を確認', '申込', '可否', '通知']) assert.ok(t.texts.some(x => x.text === name && x.part), name);
});

const bottomOfHeader = (t: LaidOutBpmn): number => t.lanes[0]!.y + t.lanes[0]!.labelH!;
/** The text of a node's name (labelBoxes also holds each node's own box under its name). */
const nameBox = (t: LaidOutBpmn, label: string) => t.labelBoxes.find(b => b.label === label && !t.anchors.some(a => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h))!;

test("bpmn({dir: 'v'}): a long gateway name in the first row stays under the lane header", async () => {
  const {t, verdict} = await laid(bpmn([{id: 'a', label: '営業'}, {id: 'b', label: '事務'}],
    [{id: 'g', lane: 'a', kind: 'xor', label: '見積の内容と金額が適切かどうか'}, {id: 'x', lane: 'a', label: '修正'}, {id: 'y', lane: 'b', label: '送付'}],
    [{from: 'g', to: 'x'}, {from: 'g', to: 'y'}], {dir: 'v'}));
  assert.deepEqual(verdict.problems, []);
  const g = t.anchors.find(a => a.id === 'g')!;
  assert.ok(t.labelBoxes.filter(b => b.y < g.y + g.h / 2 && b.x > g.x + g.w).length >= 3, 'the name runs to three or more lines');
  for (const b of t.labelBoxes) assert.ok(b.y >= bottomOfHeader(t), `"${b.label}" is under the header`);
});

test("bpmn({dir: 'v'}): with many lanes, a name too wide for the room beside its shape goes above / under it, inside its column", async () => {
  const lanes = Array.from({length: 8}, (_, i) => ({id: `l${i}`, label: `L${i}`}));
  const {t, verdict} = await laid(bpmn(lanes,
    [{id: 's', lane: 'l7', kind: 'start', label: 'Received'}, {id: 'g', lane: 'l7', kind: 'xor', label: 'Approved'}, {id: 'e', lane: 'l7', kind: 'end', label: 'Completed'}],
    [{from: 's', to: 'g'}, {from: 'g', to: 'e', label: 'ok'}], {dir: 'v'}));
  assert.deepEqual(verdict.problems, []);
  const col = t.lanes[7]!;
  assert.ok(col.w < 120, `the columns are narrow (${col.w}px)`);
  for (const name of ['Received', 'Approved', 'Completed']) {
    const b = nameBox(t, name);
    assert.ok(b.x >= col.x && b.x + b.w <= col.x + col.w, `"${name}" stays in its column`);
  }
  const e = t.anchors.find(a => a.id === 'e')!, name = nameBox(t, 'Completed');
  assert.ok(name.y >= e.y + e.h, 'the end event is named under its shape');
  const s = t.anchors.find(a => a.id === 's')!;
  assert.ok(nameBox(t, 'Received').y + nameBox(t, 'Received').h <= s.y, 'a start event is named above its shape (its bottom stays free)');
  assert.equal(t.edges.find(x => x.from === 's')!.points.length, 2, 'so its flow goes straight down');
  const g = t.anchors.find(a => a.id === 'g')!, out = t.edges.find(x => x.from === 'g')!.points[0]!;
  assert.equal(out.y, g.y + g.h / 2, 'a gateway named under its shape leaves by a side vertex');
});

test("bpmn({dir: 'v'}): a gateway named under its shape with three flows out throws; a Japanese name is not stacked a character a line", async () => {
  const lanes = Array.from({length: 8}, (_, i) => ({id: `l${i}`, label: `L${i}`}));
  await assert.rejects(laid(bpmn(lanes,
    [{id: 'g', lane: 'l3', kind: 'xor', label: 'Approved'}, {id: 'a', lane: 'l2', label: 'A'}, {id: 'b', lane: 'l3', label: 'B'}, {id: 'c', lane: 'l4', label: 'C'}],
    [{from: 'g', to: 'a'}, {from: 'g', to: 'b'}, {from: 'g', to: 'c'}], {dir: 'v'})), /"g" \(Approved\) does not fit beside it .* would block the bottom vertex/);
  const {t, verdict} = await laid(bpmn(lanes, [{id: 'g', lane: 'l3', kind: 'xor', label: '承認済みかどうか'}, {id: 'a', lane: 'l3', label: 'A'}], [{from: 'g', to: 'a'}], {dir: 'v'}));
  assert.deepEqual(verdict.problems, []);
  const lines = t.texts.filter(x => x.part?.startsWith('gateway:'));
  assert.ok(lines.length <= 2, `the name takes ${lines.length} lines`);
});

test("bpmn({dir: 'v'}): three flows into one event keep off its name", async () => {
  const {t, verdict} = await laid(bpmn([{id: 'a', label: 'A'}, {id: 'b', label: 'B'}, {id: 'c', label: 'C'}],
    [{id: 's', lane: 'b', kind: 'start'}, {id: 'g', lane: 'b', kind: 'and'}, {id: 'x', lane: 'a', label: '作業1'}, {id: 'y', lane: 'b', label: '作業2'}, {id: 'z', lane: 'c', label: '作業3'}, {id: 'e', lane: 'b', kind: 'end', label: '完了'}],
    [{from: 's', to: 'g'}, {from: 'g', to: 'x'}, {from: 'g', to: 'y'}, {from: 'g', to: 'z'}, {from: 'x', to: 'e'}, {from: 'y', to: 'e'}, {from: 'z', to: 'e'}], {dir: 'v'}));
  assert.deepEqual(verdict.problems, []);
  const name = nameBox(t, '完了'), e = t.anchors.find(a => a.id === 'e')!;
  const touches = (r: {a: {x: number; y: number}; b: {x: number; y: number}}, b: {x: number; y: number; w: number; h: number}) =>
    Math.min(r.a.x, r.b.x) <= b.x + b.w && Math.max(r.a.x, r.b.x) >= b.x && Math.min(r.a.y, r.b.y) <= b.y + b.h && Math.max(r.a.y, r.b.y) >= b.y;
  const heads: number[] = [];
  for (const ed of t.edges.filter(x => x.to === 'e')) {
    const runs = runsOf(ed.points);
    for (const r of runs) assert.ok(!touches(r, name), `${ed.from} -> e crosses the name`);
    for (const r of runs.slice(0, -1)) assert.ok(!touches(r, e), `${ed.from} -> e runs across the event before its last run`);
    const last = runs[runs.length - 1]!;
    assert.ok(Math.abs(last.b.x - last.a.x) + Math.abs(last.b.y - last.a.y) >= 12, `${ed.from} -> e has room for its arrowhead`);
    if (last.a.x === last.b.x) heads.push(last.b.x);
  }
  heads.sort((p, q) => p - q);
  for (let i = 1; i < heads.length; i++) assert.ok(heads[i]! - heads[i - 1]! >= 10, 'arrowheads into the top stay apart');
  for (const ed of t.edges) { const r = runsOf(ed.points); assert.ok(r.length > 0 && ed.points.every((p, i) => i === 0 || p.x !== ed.points[i - 1]!.x || p.y !== ed.points[i - 1]!.y), `${ed.from} -> ${ed.to} has no empty run`); }
});

test("bpmn({dir: 'v'}): a loop on a task in the rightmost lane turns to the left, inside the figure", async () => {
  const {t, verdict} = await laid(bpmn(Array.from({length: 5}, (_, i) => ({id: `l${i}`, label: `担当${i}`})),
    [{id: 't', lane: 'l4', label: '入力された内容をもう一度確かめる'}], [{from: 't', to: 't', label: '再確認'}], {dir: 'v'}));
  assert.deepEqual(verdict.problems, []);
  const loop = t.edges[0]!, task = t.anchors.find(a => a.id === 't')!;
  assert.ok(loop.points.every(p => p.x >= t.x && p.x <= t.x + t.w), 'the loop is inside the figure');
  assert.ok(loop.points.some(p => p.x < task.x), 'it turns on the left');
  const chip = t.labels[0]!;
  assert.ok(chip.x >= t.x && chip.x + chip.w <= t.x + t.w, 'its condition is inside the figure');
  // one wide lane: there is no room beside the loop on either side, so the condition goes above / below the task, inside the figure
  const one = await laid(bpmn([{id: 'a', label: 'A'}], [{id: 't', lane: 'a', label: '入力された内容をもう一度確かめる作業'}], [{from: 't', to: 't', label: 'again'}], {dir: 'v'}));
  assert.deepEqual(one.verdict.problems, []);
  const c1 = one.t.labels[0]!;
  assert.ok(c1.x >= one.t.x && c1.x + c1.w <= one.t.x + one.t.w, 'the condition of a loop in a single wide lane is inside the figure');
});

test("bpmn({dir: 'v'}): the lane header is on the 4px grid; the error for too many lanes says how many fit", async () => {
  // body 15: a line is 21px high, so the header (a line + 2 × 10) is 41px before it is rounded up
  const b = bpmn([{id: 'a', label: '担当'}], [{id: 't', lane: 'a', label: '作業'}], []);
  const t = layoutSwimlaneAutoVertical(b, 0, 0, 600, (a, size) => a.length * size, {...ROLES, body: 15}, {wrap: 'bunsetsu', keepWords: false});
  assert.equal(t.lanes[0]!.labelH, 44);
  await assert.rejects(laid(bpmn(Array.from({length: 9}, (_, i) => ({id: `l${i}`, label: `L${i}`})), [{id: 'n', lane: 'l0', label: 'N'}], [], {dir: 'v'})), /at most 8 lanes/);
});

test("bpmn({dir: 'v'}) SVG: the lane names are a header row; arrows keep their heads", async () => {
  const {svg} = await renderDiagram(diagram({theme: 'blue'}).add(quote()), {name: 'bv.svg', budget: 'cacheOnly'});
  assert.match(svg, /<rect x="\d+" y="\d+" width="\d+" height="\d+" fill="#f6f8fa"/);
  assert.equal((svg.match(/stroke-dasharray="6,4"/g) ?? []).length, 7);
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
  const {verdict} = await checkDiagram(diagram({theme: 'blue'}).add(b, box({id: 'doc', title: '手順書'}), connect('ship', 'doc', {route: 'elbow'})));
  assert.deepEqual(verdict.problems, []);
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

const L2 = [{id: 'a', label: '申請者'}, {id: 'b', label: '審査'}];

test('bpmn(): a start event takes no flow in, an end event none out (message events are not drawn)', async () => {
  const bad = (flows: object[]) => checkDiagram(diagram({theme: 'blue'}).add(bpmn(L2, [{id: 's', lane: 'a', kind: 'start'}, {id: 't', lane: 'b', label: '確認'}, {id: 'e', lane: 'b', kind: 'end'}], flows as never)));
  await assert.rejects(() => bad([{from: 't', to: 's'}]), /start event takes no flow into it/);
  await assert.rejects(() => bad([{from: 'e', to: 't'}]), /end event has no flow out/);
});

test('bpmn(): a long lane name fits its lane (the lane grows), inside the figure', async () => {
  const name = '株式会社サンプル 東日本営業本部 第二営業部 法人営業課 担当者';
  const {t, verdict} = await laid(bpmn([{id: 'a', label: name}, {id: 'b', label: '審査'}], [{id: 's', lane: 'a', kind: 'start'}, {id: 'k', lane: 'b', label: '確認'}], [{from: 's', to: 'k'}]));
  assert.deepEqual(verdict.problems, []);
  const lines = t.texts.filter(x => x.anchor === 'middle' && x.x < t.x + 140 && x.y < t.lanes[0]!.y + t.lanes[0]!.h + 1 && x.bold);
  assert.ok(lines.length >= 3);
  for (const l of lines) assert.ok(l.y - l.size >= t.lanes[0]!.y - 0.5 && l.y <= t.lanes[0]!.y + t.lanes[0]!.h + 0.5, `"${l.text}" is inside lane 1`);
});

test('bpmn(): a gateway label stays clear of the flows, the nodes and the lane names (left column, stacked, long label)', async () => {
  const cases = [
    bpmn(L2, [{id: 't', lane: 'a', label: '申請'}, {id: 'g', lane: 'b', kind: 'xor', label: '内容は妥当か?'}, {id: 'e', lane: 'b', kind: 'end'}], [{from: 't', to: 'g'}, {from: 'g', to: 'e', label: 'はい'}]),
    bpmn([{id: 'b', label: '審査'}], [{id: 'g', lane: 'b', kind: 'xor', label: '条件分岐の判定をする'}, {id: 'e', lane: 'b', kind: 'end'}], [{from: 'g', to: 'e'}]),
    bpmn([{id: 'a', label: '申請者'}, {id: 'b', label: '審査'}], [{id: 's', lane: 'a', kind: 'start'}, {id: 't1', lane: 'b', label: '確認'}, {id: 'g', lane: 'b', kind: 'and', label: '並行処理'}, {id: 'e', lane: 'b', kind: 'end'}], [{from: 's', to: 't1'}, {from: 's', to: 'g'}, {from: 't1', to: 'e'}, {from: 'g', to: 'e'}]),
  ];
  for (const [i, c] of cases.entries()) {
    const {t, verdict} = await laid(c);
    assert.deepEqual(verdict.problems, [], `case ${i}`);
    const gl = t.labelBoxes.filter(b => !t.anchors.some(a => a.x === b.x && a.y === b.y && a.w === b.w) && /妥当|条件分岐|並行/.test(b.label));
    assert.ok(gl.length, `case ${i} has a gateway label`);
    for (const b of gl) assert.ok(b.x >= t.x + t.lanes[0]!.labelW, `case ${i}: "${b.label}" is right of the lane names`);
  }
});

test('bpmn(): a detour along the lane edge is checked again (a wide node of another lane in the same column)', async () => {
  const {verdict} = await laid(bpmn(
    [{id: 'a', label: 'A'}, {id: 'b', label: 'B'}, {id: 'c', label: 'C'}],
    [{id: 's', lane: 'a', kind: 'start'}, {id: 'g', lane: 'a', kind: 'and'}, {id: 'p', lane: 'b', label: '幅の広い名前のタスク'}, {id: 'x', lane: 'c', label: '末端'}, {id: 'q', lane: 'b', label: '前段'}],
    [{from: 's', to: 'g'}, {from: 'g', to: 'q'}, {from: 'q', to: 'p'}, {from: 'g', to: 'x'}],
  ));
  assert.deepEqual(verdict.problems, []);
});

test('bpmn(): a flow from a node to itself keeps its label off the node; chips use the note size on a slide canvas', async () => {
  const {t, verdict} = await laid(bpmn([{id: 'a', label: '担当'}], [{id: 'k', lane: 'a', label: '作業'}], [{from: 'k', to: 'k', label: '再試行'}]));
  assert.deepEqual(verdict.problems, []);
  assert.equal(t.labels.length, 1);
  const slide = await checkDiagram(diagram({canvas: 'slide', theme: 'blue'}).add(bpmn([{id: 'a', label: '担当'}], [{id: 'x', lane: 'a', label: '作業'}, {id: 'y', lane: 'a', label: '確認'}], [{from: 'x', to: 'y', label: '済み'}])));
  const sl = slide.laidOut.laidOut.find(b => b.type === 'bpmn') as LaidOutBpmn;
  assert.equal(sl.labels[0]!.size, slide.laidOut.roles.note);
});

test('bpmn(): a node tone is checked like a lane tone; node ids come with the figure (reveal); a node id cannot be spotlighted', async () => {
  assert.throws(() => bpmn([{id: 'a', label: 'A'}], [{id: 'x', lane: 'a', label: 'x', tone: 'foo' as never}], []), /tone/);
  // a node may be filled (ADR 0051: 'solid' / 'solid-danger' draw white text); a lane may not
  assert.doesNotThrow(() => bpmn([{id: 'a', label: 'A'}], [{id: 'x', lane: 'a', label: 'x', tone: 'solid'}], []));
  assert.throws(() => bpmn([{id: 'a', label: 'A', tone: 'solid' as never}], [{id: 'x', lane: 'a', label: 'x'}], []), /tone/);
  const b = bpmn([{id: 'a', label: 'A'}], [{id: 'x', lane: 'a', label: 'x'}], [], {reveal: 2});
  const {laidOut} = await checkDiagram(diagram({theme: 'blue'}).add(b, box({id: 'ext', title: '外部', reveal: 2}), connect('x', 'ext', {route: 'elbow'})));
  assert.equal(laidOut.connects[0]!.reveal, 2);
  await assert.rejects(() => checkDiagram(diagram({theme: 'blue', spotlight: 'x'}).add(bpmn([{id: 'a', label: 'A'}], [{id: 'x', lane: 'a', label: 'x'}], []))), /node inside a figure/);
});

test('bpmn(): a connector that ends on the whole figure (its id) is not stopped by its nodes', async () => {
  const b = bpmn(L2, [{id: 's', lane: 'a', kind: 'start'}, {id: 't', lane: 'b', label: '確認'}, {id: 'e', lane: 'b', kind: 'end'}], [{from: 's', to: 't'}, {from: 't', to: 'e'}], {id: 'P'});
  const {verdict} = await checkDiagram(diagram({theme: 'blue'}).add(b, box({id: 'ext', title: '外部'}), connect('P', 'ext', {route: 'elbow'})));
  assert.deepEqual(verdict.problems, []);
});

const expense = (fit?: 'shrink') => bpmn(
  [{id: 'a', label: '申請者'}, {id: 'm', label: '上長'}, {id: 'f', label: '経理'}],
  [
    {id: 's', lane: 'a', kind: 'start', label: '出張から戻る'}, {id: 'w', lane: 'a', label: '精算書を作成', sub: '領収書を添付'},
    {id: 'ap', lane: 'm', label: '内容を承認'}, {id: 'g', lane: 'm', kind: 'xor', label: '承認'},
    {id: 'ck', lane: 'f', label: '領収書を照合'}, {id: 'pay', lane: 'f', label: '振込を手配', sub: '月末締め翌月払い'}, {id: 'e', lane: 'a', kind: 'end', label: '入金'},
  ],
  [
    {from: 's', to: 'w'}, {from: 'w', to: 'ap'}, {from: 'ap', to: 'g'}, {from: 'g', to: 'ck', label: '承認'}, {from: 'g', to: 'w', label: '却下'},
    {from: 'ck', to: 'pay'}, {from: 'pay', to: 'e', line: 'dashed'},
  ],
  fit ? {fit} : {},
);

test("bpmn({fit: 'shrink'}): a 3-lane expense flow that overflows 940px by default fits when opted in", async () => {
  await assert.rejects(() => laid(expense()), /wide but it has .*fit: 'shrink'/);
  const {t, verdict} = await laid(expense('shrink'));
  assert.deepEqual(verdict.problems, []);
  assert.ok(t.nodes.every(n => n.x >= t.x && n.x + n.w <= t.x + t.w), 'every node is inside the figure');
});

test("bpmn({fit: 'shrink'}) leaves a figure that already fits exactly as it was", async () => {
  const [plain, shrunk] = await Promise.all([laid(flow()), laid(flow({fit: 'shrink'}))]);
  assert.deepEqual(shrunk.t, plain.t);
});

test("bpmn(): fit other than 'shrink' throws; a flow too wide even shrunk still throws", async () => {
  assert.throws(() => bpmn([{id: 'a', label: 'a'}], [{id: 'x', lane: 'a', label: 'x'}], [], {fit: 'auto' as never}), /fit must be 'shrink'/);
  const ids = Array.from({length: 14}, (_, i) => `n${i}`);
  const long = bpmn([{id: 'a', label: '担当'}], ids.map(id => ({id, lane: 'a', label: '長めの作業名'})), ids.slice(1).map((id, i) => ({from: ids[i]!, to: id})), {fit: 'shrink'});
  await assert.rejects(() => laid(long), /even shrunk/);
});

test('bpmn(): a flow back from a node with another node right under it does not run through that node', async () => {
  const {t, verdict} = await laid(bpmn(
    [{id: 'a', label: '営業'}, {id: 'b', label: '事務'}],
    [
      {id: 'mk', lane: 'b', label: '作成'}, {id: 'fix', lane: 'a', label: '修正を依頼'}, {id: 'ans', lane: 'a', label: '返信'},
    ],
    [{from: 'mk', to: 'fix'}, {from: 'mk', to: 'ans'}, {from: 'fix', to: 'mk', line: 'dashed'}],
  ));
  assert.deepEqual(verdict.problems, []);
  const back = t.edges.find(e => e.from === 'fix' && e.to === 'mk');
  const ans = t.nodes[2];
  assert.ok(back && ans);
  assert.ok(!back.points.slice(1).some((q, i) => overlap({x: Math.min(back.points[i]!.x, q.x), y: Math.min(back.points[i]!.y, q.y), w: Math.abs(back.points[i]!.x - q.x) + 1, h: Math.abs(back.points[i]!.y - q.y) + 1}, ans)));
});

test('bpmn(): a flow back to a node of the same lane with a node between them stays clear of every box', async () => {
  const {t, verdict} = await laid(bpmn(
    [{id: 'a', label: '担当'}, {id: 'b', label: '別担当'}],
    [{id: 's', lane: 'a', kind: 'start', label: '開始'}, {id: 'x', lane: 'a', label: '二'}, {id: 'y', lane: 'a', label: '三'}, {id: 'z', lane: 'a', label: '四'}],
    [{from: 's', to: 'x'}, {from: 's', to: 'y'}, {from: 's', to: 'z'}, {from: 'x', to: 'z'}, {from: 'z', to: 'x'}],
  ));
  assert.deepEqual(verdict.problems, []);
  assert.ok(t.edges.some(e => e.from === 'z' && e.to === 'x'));
});

test('bpmn(): a gateway name stays clear of the flows that leave its top / bottom vertex and of the shapes round it', async () => {
  const {verdict} = await laid(bpmn(
    [{id: 'c', label: 'お客様'}, {id: 's', label: '営業'}, {id: 'j', label: '事務'}, {id: 'k', label: '経理'}],
    [
      {id: 'n1', lane: 'c', kind: 'start', label: '見積依頼'}, {id: 'n2', lane: 'j', label: '見積書を作成'}, {id: 'n3', lane: 's', label: '見積書を確認'},
      {id: 'g1', lane: 's', kind: 'xor', label: '内容は適切か'}, {id: 'n3c', lane: 's', label: '修正を依頼'}, {id: 'n3d', lane: 's', label: 'お客様へ返信'},
      {id: 'g2', lane: 's', kind: 'xor', label: '受注するか'}, {id: 'lost', lane: 's', kind: 'end', label: '失注'}, {id: 'n6', lane: 'j', label: '受注台帳に入力'},
      {id: 'n7', lane: 'k', label: '請求・入金確認'}, {id: 'e', lane: 'k', kind: 'end', label: '完了'},
    ],
    [
      {from: 'n1', to: 'n2', line: 'dashed'}, {from: 'n2', to: 'n3', line: 'dashed'}, {from: 'n3', to: 'g1'}, {from: 'g1', to: 'n3d', label: '問題なし'},
      {from: 'g1', to: 'n3c', label: '要修正'}, {from: 'n3c', to: 'n2', line: 'dashed'}, {from: 'n3d', to: 'g2'}, {from: 'g2', to: 'lost', label: '受注せず'},
      {from: 'g2', to: 'n6', label: '受注', line: 'dashed'}, {from: 'n6', to: 'n7', line: 'dashed'}, {from: 'n7', to: 'e'},
    ],
    {fit: 'shrink'},
  ));
  assert.deepEqual(verdict.problems, []);
});

test('bpmn(): a flow up into an end event does not overshoot above it to clear the event name', async () => {
  const {t, verdict} = await laid(bpmn(
    [{id: 'p', label: '担当者'}, {id: 'c', label: 'Copilot'}],
    [{id: 'st', lane: 'p', kind: 'start', label: '月次の資料作成'}, {id: 'pp', lane: 'c', label: 'Copilot in PowerPoint', sub: '朝会資料の見出し下書き'}, {id: 'end', lane: 'p', kind: 'end', label: '確認・提出'}],
    [{from: 'st', to: 'pp'}, {from: 'pp', to: 'end'}],
    {fit: 'shrink'},
  ));
  assert.deepEqual(verdict.problems, []);
  const end = t.anchors.find(a => a.id === 'end')!, e = t.edges.find(x => x.to === 'end')!;
  const top = Math.min(...e.points.map(p => p.y));
  assert.ok(top >= end.y + end.h / 2 - 0.5, `the flow turns at the end event's height (top ${top}, event centre ${end.y + end.h / 2})`);
});

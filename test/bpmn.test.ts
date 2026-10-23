import test from 'node:test';
import './helpers/strict-width.ts'; // a label the layout did not register for measuring throws instead of measuring 0 wide
import assert from 'node:assert/strict';
import {bpmn, box, checkDiagram, closeMeasurer, connect, diagram, renderDiagram} from '../lib/dsl.ts';
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
  assert.throws(() => bpmn([{id: 'a', label: 'A'}], [{id: 'x', lane: 'a', label: 'x', tone: 'solid' as never}], []), /solid|tone/);
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

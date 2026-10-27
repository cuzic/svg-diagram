// ADR 0034: `renderDiagram({nodeIds: true})` puts data-node="name" on the frame of each named node; without it the SVG is the same as ever.
import test from 'node:test';
import './helpers/strict-width.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {register} from 'node:module';
import {bpmn, box, causeTree, checkDiagram, chevron, closeMeasurer, concentric, cycle, diagram, emblem, funnel, grid, mindmap, quadrant, relationDiagram, renderDiagram, row, tree, venn, whyWhyTree} from '../lib/dsl.ts';
import {loadConfig} from '../lib/config.ts';
import {loadDiagram} from '../lib/load-source.ts';
import {emitRevealStage} from '../lib/pipeline.ts';
import {withNodeIds, withNodeIdsBand} from '../lib/emit-node-ids.ts';
import type {LaidOutBand} from '../lib/types/index.ts';

register(new URL('../lib/resolve-hook.ts', import.meta.url)); // the examples import 'svg-diagram'
test.after(() => closeMeasurer());

const marks = (svg: string): string[] => [...svg.matchAll(/ data-node="([^"]*)"/g)].map(m => m[1]!);
const strip = (svg: string): string => svg.replaceAll(/ data-node="[^"]*"/g, '');
const draw = (d: ReturnType<typeof diagram>, nodeIds?: boolean) => renderDiagram(d, {name: 't', budget: 'cacheOnly', ...(nodeIds ? {nodeIds} : {})});
const sorted = (a: string[]) => [...a].sort();

const crt = () => diagram({theme: 'blue'}).add(causeTree(
  [{id: 'late', label: '納期に遅れる', role: 'ude'}, {id: 'wip', label: '仕掛りが多い'}, {id: 'kpi', label: '稼働率で評価される', role: 'root'}],
  [{from: 'kpi', to: 'wip'}, {from: 'wip', to: 'late'}],
));

test('nodeIds: a cause tree marks each node by its own id; each appears once', async () => {
  assert.deepEqual(sorted(marks((await draw(crt(), true)).svg)), ['kpi', 'late', 'wip']);
});

test('nodeIds is off by default, and on adds the attribute and nothing else (a figure of each kind)', async () => {
  const figures = [
    crt(),
    diagram({theme: 'blue'}).add(box({id: 'x', title: 'X'}), box({id: 'y', title: 'Y', tone: 'accent'})),
    diagram({theme: 'blue'}).add(tree({id: 'r', label: '目的', children: [{id: 'a', label: '手段'}]}, {dir: 'right'})),
    diagram({theme: 'blue'}).add(bpmn([{id: 'l', label: '担当'}], [{id: 's', lane: 'l', kind: 'start', label: ''}, {id: 't', lane: 'l', label: '作業'}], [{from: 's', to: 't'}])),
    diagram({theme: 'blue'}).add(row([box({id: 'a', title: 'A'}), box({id: 'b', title: 'B'})])),
    diagram({theme: 'blue', appearance: 'auto'}).add(relationDiagram([{id: 'p', label: '原因'}, {id: 'q', label: '結果'}], [{from: 'p', to: 'q'}], {problem: 'q'})),
  ];
  for (const f of figures) {
    const plain = await draw(f), off = await draw(f, false), on = await draw(f, true);
    assert.equal(off.svg, plain.svg);
    assert.ok(!plain.svg.includes('data-node'));
    assert.ok(marks(on.svg).length > 0);
    assert.equal(strip(on.svg), plain.svg);
  }
});

test('nodeIds off: every example figure draws the same with the option on once the attributes are removed', async () => {
  const dir = path.resolve('examples');
  for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.ts')).sort()) {
    const abs = path.join(dir, f);
    const load = () => loadDiagram(abs, loadConfig(dir));
    const plain = await renderDiagram(await load(), {name: f, budget: 'cacheOnly'});
    const on = await renderDiagram(await load(), {name: f, budget: 'cacheOnly', nodeIds: true});
    assert.equal(strip(on.svg), plain.svg, f);
  }
});

test('nodeIds: a tree marks the nodes that have an id; a mind map (the fishbone layout too) does the same', async () => {
  const t = await draw(diagram({theme: 'blue'}).add(tree({id: 'root', label: '目的', children: [{id: 'a', label: '手段 A'}, {label: '手段 B'}]}, {dir: 'right'})), true);
  assert.deepEqual(sorted(marks(t.svg)), ['a', 'root']);
  const topic = {id: 'top', label: '特性', children: [{id: 'c1', label: '人', children: [{id: 'f1', label: '経験差'}]}, {label: '機械'}]};
  for (const layout of ['fishbone', 'right'] as const) {
    const r = await draw(diagram({theme: 'blue'}).add(mindmap(topic as never, {layout} as never)), true);
    assert.deepEqual(sorted(marks(r.svg)), ['c1', 'f1', 'top']);
  }
});

test('nodeIds: a task is marked; an event and a gateway are not (no frame element to carry it)', async () => {
  const r = await draw(diagram({theme: 'blue'}).add(bpmn(
    [{id: 'a', label: '顧客'}, {id: 'b', label: '店舗'}],
    [{id: 's', lane: 'a', kind: 'start', label: '注文'}, {id: 'chk', lane: 'b', label: '在庫を確認'}, {id: 'g', lane: 'b', kind: 'xor', label: '在庫'}, {id: 'e', lane: 'a', kind: 'end'}],
    [{from: 's', to: 'chk'}, {from: 'chk', to: 'g'}, {from: 'g', to: 'e'}],
  )), true);
  assert.deepEqual(marks(r.svg), ['chk']);
});

test('nodeIds: a box with an id is marked, in a band of its own and in a row or a grid', async () => {
  assert.deepEqual(marks((await draw(diagram({theme: 'blue'}).add(box({id: 'x', title: 'X'}), box({title: 'no id'})), true)).svg), ['x']);
  assert.deepEqual(sorted(marks((await draw(diagram({theme: 'blue'}).add(row([box({id: 'a', title: 'A'}), box({id: 'b', title: 'B'})])), true)).svg)), ['a', 'b']);
  assert.deepEqual(sorted(marks((await draw(diagram({theme: 'blue'}).add(grid([box({id: 'g1', title: '1'}), box({id: 'g2', title: '2'})], {cols: 2})), true)).svg)), ['g1', 'g2']);
});

test('nodeIds: the name is the one connect() uses: scope.id, so two figures with the same ids stay apart', async () => {
  const two = diagram({theme: 'blue'}).add(
    tree({label: 'A', children: [{id: 'r', label: 'a'}]}, {scope: 's1'} as never),
    tree({label: 'B', children: [{id: 'r', label: 'b'}]}, {scope: 's2'} as never),
  );
  assert.deepEqual(sorted(marks((await draw(two, true)).svg)), ['s1.r', 's2.r']);
});

test('nodeIds: why-why marks the names connect() can use: the author\'s ids, and `id.problem` style ones only when the figure has an id', async () => {
  const whys = [{id: 'cause', why: '検証が遅い', trueCause: true as const}, {why: '別の原因'}];
  const named = marks((await draw(diagram({theme: 'blue'}).add(...whyWhyTree('遅れた', whys, {id: 'w'} as never)), true)).svg);
  assert.ok(named.includes('cause') && named.includes('w.problem'), named.join());
  assert.ok(!named.includes('problem'), named.join());
  const noId = marks((await draw(diagram({theme: 'blue'}).add(...whyWhyTree('遅れた', whys)), true)).svg);
  assert.deepEqual(noId, ['cause']); // the maker's own names (problem, w1, ...) are not names an author can use: no mark
});

test('nodeIds: the stages of a click-through draw carry the names too when asked', async () => {
  const d = diagram({theme: 'blue'}).add(tree({id: 'r', label: '目的', children: [{id: 'c', label: '手段'}]}, {reveal: 1} as never));
  const {laidOut} = await checkDiagram(d);
  assert.deepEqual(marks(emitRevealStage(laidOut, 1)), []);
  assert.ok(marks(emitRevealStage(laidOut, 1, {nodeIds: true})).includes('r'));
});

test('withNodeIds: a band that has no named frame is returned as it is', () => {
  const caption = {type: 'caption', x: 0, y: 0, w: 10, h: 10} as unknown as LaidOutBand;
  assert.equal(withNodeIdsBand(caption), caption);
  const d = {laidOut: [caption]} as never;
  assert.equal((withNodeIds(d) as {laidOut: LaidOutBand[]}).laidOut[0], caption);
});

test('nodeIds: a flow shape marks the frame of each item that has an id (chevron, funnel, cycle, venn, concentric, emblem), once each, and not the others', async () => {
  const steps = [{id: 'a', label: '調べる'}, {label: '決める'}, {id: 'c', label: 'やる'}];
  const figs: [string, ReturnType<typeof diagram>, string[]][] = [
    ['chevron', diagram({theme: 'blue'}).add(chevron(steps)), ['a', 'c']],
    ['chevron vertical', diagram({theme: 'blue'}).add(chevron(steps, {direction: 'vertical'})), ['a', 'c']],
    ['funnel', diagram({theme: 'blue'}).add(funnel([{id: 'v', label: '訪問', value: 100}, {label: '登録', value: 40}, {id: 'p', label: '購入', value: 10}])), ['p', 'v']],
    ['cycle', diagram({theme: 'blue'}).add(cycle(steps)), ['a', 'c']],
    ['venn', diagram({theme: 'blue'}).add(venn([{id: 's1', name: 'A'}, {id: 's2', name: 'B'}])), ['s1', 's2']],
    ['concentric', diagram({theme: 'blue'}).add(concentric([{id: 'in', label: '中心'}, {id: 'out', label: '外側'}, {label: '周辺'}])), ['in', 'out']],
    ['emblem circle', diagram({theme: 'blue'}).add(emblem([{id: 'e1', label: '一'}, {label: '二'}, {id: 'e3', label: '三'}])), ['e1', 'e3']],
    ['emblem polygon', diagram({theme: 'blue'}).add(emblem([{id: 'e1', label: '一'}, {id: 'e2', label: '二'}], {shape: 'trapezoid'})), ['e1', 'e2']],
    ['emblem path', diagram({theme: 'blue'}).add(emblem([{id: 'e1', label: '一'}, {id: 'e2', label: '二'}], {shape: 'cylinder'})), ['e1', 'e2']],
  ];
  for (const [name, d, want] of figs) {
    const on = await draw(d, true), off = await draw(d);
    assert.deepEqual(sorted(marks(on.svg)), sorted(want), name);
    assert.deepEqual(marks(off.svg), [], `${name}: off by default`);
    assert.equal(strip(on.svg), off.svg, `${name}: nothing else changes`);
  }
});

test('nodeIds: a flow shape with a scope names its items scope.id, as connect() does', async () => {
  const d = diagram({theme: 'blue'}).add(chevron([{id: 'a', label: '調べる'}, {id: 'b', label: '決める'}], {scope: 'flow1'}));
  assert.deepEqual(sorted(marks((await draw(d, true)).svg)), ['flow1.a', 'flow1.b']);
});

test('nodeIds: a quadrant marks the marker and every line of the name of each item that has an id', async () => {
  const q = () => diagram({theme: 'blue'}).add(quadrant({
    x: {title: '価格', low: '安い', high: '高い'}, y: {title: '品質', low: '低い', high: '高い'}, crosshair: true,
    items: [{id: 'p', label: '製品 A', at: [0.8, 0.8]}, {id: 'r', label: '製品 B は名前が長いので折り返される長さにしてある文字列', at: [0.2, 0.3]}, {label: '名前なし', at: [0.5, 0.5]}],
  }));
  const on = await draw(q(), true), off = await draw(q());
  const marked = marks(on.svg);
  assert.deepEqual([...new Set(marked)].sort(), ['p', 'r']);
  // the marker (a circle / polygon) and the label (a <text>) each carry it
  assert.ok(/<(circle|polygon)[^>]* data-node="p"/.test(on.svg), 'the marker of p');
  assert.ok(/<text[^>]* data-node="p"[^>]*>製品 A<\/text>/.test(on.svg), 'the label of p');
  assert.ok(marked.filter(m => m === 'r').length >= 3, 'r: its marker and each wrapped line of its label');
  assert.ok(!/data-node="[^"]*"[^>]*>名前なし/.test(on.svg), 'an item with no id is not marked');
  assert.deepEqual(marks(off.svg), []);
  assert.equal(strip(on.svg), off.svg, 'nothing else changes');
});

test('nodeIds: a quadrant item that is dimmed by a spotlight and a hollow marker still carry the name', async () => {
  const d = diagram({theme: 'blue', spotlight: 'p'}).add(quadrant({
    x: {title: '価格', low: '安い', high: '高い'}, y: {title: '品質', low: '低い', high: '高い'},
    items: [{id: 'p', label: '製品 A', at: [0.8, 0.8], group: 'a'}, {id: 'q', label: '製品 B', at: [0.2, 0.3], group: 'b'}],
  }));
  assert.deepEqual([...new Set(marks((await draw(d, true)).svg))].sort(), ['p', 'q']);
});

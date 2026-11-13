// Round R3 of the spec: bpmn, classDiagram, pert, timeline, tree and dependencyNetwork. Each draws what the DSL draws, and a mistake is
// reported at its place before any layout.
import test from 'node:test';
import assert from 'node:assert/strict';
import {bpmn, classDiagram, closeMeasurer, dependencyNetwork, diagram, pert, renderDiagram, timeline, tree} from '../lib/dsl.ts';
import {remainingText} from '../lib/timeline.ts';
import {specToDiagram, validateSpec} from '../lib/spec.ts';
import {MAX_BPMN_NODES, MAX_PERT_TASKS, remainingEn} from '../lib/spec-parts/r3.ts';
import type {Diagram} from '../lib/types/index.ts';

test.after(() => closeMeasurer());

const svgOf = async (d: unknown) => (await renderDiagram(d as Diagram, {name: 'x.svg', budget: 'cacheOnly'})).svg;
const spec = (...parts: unknown[]) => ({version: 1, title: '例', parts});
const dsl = () => diagram({theme: 'blue', title: '例'});
const pathsOf = (input: unknown) => validateSpec(input).map(i => i.path);
const same = async (part: Record<string, unknown>, built: unknown) => assert.equal(await svgOf(specToDiagram(spec(part))), await svgOf(dsl().add(built as never)));

const LANES = [{id: 'c', label: '顧客'}, {id: 's', label: '店舗'}];
const NODES = [{id: 'st', lane: 'c', kind: 'start', label: '注文'}, {id: 'chk', lane: 's', label: '在庫を確認'}, {id: 'g', lane: 's', kind: 'xor'}, {id: 'ok', lane: 's', label: '発送する'}, {id: 'e', lane: 'c', kind: 'end'}];
const FLOWS = [{from: 'st', to: 'chk'}, {from: 'chk', to: 'g'}, {from: 'g', to: 'ok', label: '在庫あり'}, {from: 'ok', to: 'e', line: 'dashed'}];

test('bpmn, classDiagram, pert, tree and dependencyNetwork specs draw the same SVG as the DSL', async () => {
  await same({type: 'bpmn', lanes: LANES, nodes: NODES, flows: FLOWS}, bpmn(LANES, NODES as never, FLOWS as never, {fit: 'shrink'}));
  const classes = [{id: 'Animal', abstract: true, methods: ['+ speak(): string']}, {id: 'Dog', attrs: ['- name: string'], tone: 'accent'}];
  const relations = [{from: 'Dog', to: 'Animal', kind: 'inherit'}];
  await same({type: 'classDiagram', classes, relations, dir: 'down'}, classDiagram(classes as never, relations as never, {dir: 'down'}));
  const tasks = [{id: 'a', label: '設計', duration: 3}, {id: 'b', label: '実装', duration: 5, predecessors: ['a']}];
  await same({type: 'pert', tasks, unit: '日', compact: true}, pert(tasks, {unit: '日', compact: true}));
  const root = {label: '全体', children: [{label: '設計', children: [{label: '画面'}]}, {label: '開発', sub: '4 人'}]};
  await same({type: 'tree', root, dir: 'right'}, tree(root, {dir: 'right'}));
  const nodes = [{id: 'w', label: 'Web', kind: '画面'}, {id: 'a', label: 'API'}];
  const edges = [{from: 'w', to: 'a', type: 'uses', weight: 3}];
  const edgeTypes = {depends: '依存する', uses: '利用する', blocks: '阻害する', relates: '関連する'};
  await same({type: 'dependencyNetwork', nodes, edges}, dependencyNetwork(nodes, edges, {edgeTypes}));
  await same({type: 'dependencyNetwork', nodes, edges, typeLabels: {uses: '呼ぶ'}}, dependencyNetwork(nodes, edges, {edgeTypes: {...edgeTypes, uses: '呼ぶ'}}));
});

test('both forms of a timeline draw the same SVG as the DSL', async () => {
  const dated = {from: '2026-01', to: '2027-12', now: {at: '2026-10'}, deadline: {at: '2027-06', label: '保守終了', line: 'full'}, marks: [{at: '2027-01', label: '移行開始', tone: 'accent'}], span: 'fill'} as const;
  await same({type: 'timeline', ...dated}, timeline(dated as never));
  const numeric = {unit: 'ms', from: 0, to: 700, lanes: ['通信', '描画'], events: [{at: 120, label: '応答', lane: '通信'}], spans: [{from: 300, to: 644, lane: '描画', dim: true}]};
  await same({type: 'timeline', ...numeric}, timeline(numeric as never));
});

test('in English, the words a timeline and a dependency network write by themselves are English', async () => {
  const part = {type: 'timeline', from: '2026-01', to: '2027-12', now: {at: '2026-10'}, deadline: {at: '2027-06', label: 'End of support'}};
  const svg = await svgOf(specToDiagram({version: 1, lang: 'en', title: 'x', parts: [part]}));
  assert.match(svg, />Now</); assert.match(svg, /8 months left/); assert.doesNotMatch(svg, /現在|あと/);
  const kept = await svgOf(specToDiagram({version: 1, lang: 'en', title: 'x', parts: [{...part, now: {at: '2026-10', label: 'Today'}, remaining: false}]}));
  assert.match(kept, />Today</); assert.doesNotMatch(kept, /left/);
  const net = await svgOf(specToDiagram({version: 1, lang: 'en', title: 'x', parts: [{type: 'dependencyNetwork', nodes: [{id: 'a', label: 'A'}, {id: 'b', label: 'B'}], edges: [{from: 'a', to: 'b', type: 'depends'}]}]}));
  assert.match(net, /depends on/); assert.doesNotMatch(net, /依存/);
});

test('the English time left is counted the way the Japanese one is', () => {
  const cases: [string, string, string, string][] = [
    ['2026-10', '2027-06', 'あと 8 か月', '8 months left'],
    ['2026-01-15', '2026-02-01', 'あと 17 日', '17 days left'],
    ['2026-01', '2027-04', 'あと 1 年 3 か月', '1 year 3 months left'],
    ['2026-01', '2028-01', 'あと 2 年', '2 years left'],
    ['2027-03', '2027-02', '期限を 1 か月 過ぎた', '1 month overdue'],
    ['2027-03-10', '2027-03-01', '期限を 9 日 過ぎた', '9 days overdue'],
    ['2027-03', '2027-03', '期限は今日', 'Due today'],
  ];
  for (const [a, b, ja, en] of cases) { assert.equal(remainingText(a, b), ja); assert.equal(remainingEn(a, b), en); }
});

test('bpmn: lanes, ends, labels and the direction of events are checked at their places', () => {
  assert.deepEqual(pathsOf(spec({type: 'bpmn', lanes: LANES, nodes: [...NODES, {id: 'x', lane: 'nope', label: 'X'}, {id: 'chk', lane: 's', label: '重複'}, {id: 't', lane: 's'}, {id: 'g2', lane: 's', kind: 'and', sub: '補足'}],
    flows: [...FLOWS, {from: 'g', to: 'zz'}, {from: 'e', to: 'chk'}, {from: 'chk', to: 'st'}, {from: 'ok', to: 'ok'}]})).sort(), [
    'parts[0].flows[4].to', 'parts[0].flows[5].from', 'parts[0].flows[6].to', 'parts[0].flows[7].to',
    'parts[0].nodes[5].lane', 'parts[0].nodes[6].id', 'parts[0].nodes[7].label', 'parts[0].nodes[8].sub',
  ]);
  const many = Array.from({length: MAX_BPMN_NODES + 1}, (_, i) => ({id: `n${i}`, lane: 'c', label: 'x'}));
  assert.deepEqual(pathsOf(spec({type: 'bpmn', lanes: LANES, nodes: many, flows: []})), ['parts[0].nodes']);
});

test('classDiagram: unknown classes and a circle of parents are refused', () => {
  const classes = [{id: 'A'}, {id: 'B'}, {id: 'C'}];
  assert.deepEqual(pathsOf(spec({type: 'classDiagram', classes, relations: [{from: 'A', to: 'Z'}, {from: 'Q', to: 'A', kind: 'arrow'}]})), ['parts[0].relations[0].to', 'parts[0].relations[1].from']);
  const loop = validateSpec(spec({type: 'classDiagram', classes, relations: [{from: 'A', to: 'B', kind: 'inherit'}, {from: 'B', to: 'C', kind: 'implement'}, {from: 'C', to: 'A', kind: 'inherit'}]}));
  assert.deepEqual(loop.map(i => i.path), ['parts[0].relations']);
  assert.match(loop[0]?.message ?? '', /A -> B -> C -> A/);
  assert.deepEqual(pathsOf(spec({type: 'classDiagram', classes, relations: [{from: 'A', to: 'A', kind: 'inherit'}]})), ['parts[0].relations', 'parts[0].relations[0].to']);
  assert.deepEqual(validateSpec(spec({type: 'classDiagram', classes, relations: [{from: 'A', to: 'B', kind: 'arrow'}, {from: 'B', to: 'A', kind: 'arrow'}]})), [], 'associations may go both ways');
});

test('pert: predecessors must exist, not repeat, and not go round a circle', () => {
  const t = (id: string, predecessors?: string[]) => ({id, label: id, duration: 1, ...(predecessors ? {predecessors} : {})});
  assert.deepEqual(pathsOf(spec({type: 'pert', tasks: [t('a'), t('b', ['a', 'a', 'z'])]})), ['parts[0].tasks[1].predecessors[1]', 'parts[0].tasks[1].predecessors[2]']);
  const loop = validateSpec(spec({type: 'pert', tasks: [t('a', ['c']), t('b', ['a']), t('c', ['b'])]}));
  assert.deepEqual(loop.map(i => i.path), ['parts[0].tasks']);
  assert.match(loop[0]?.message ?? '', /circle/);
  assert.deepEqual(pathsOf(spec({type: 'pert', tasks: Array.from({length: MAX_PERT_TASKS + 1}, (_, i) => t(`t${i}`))})), ['parts[0].tasks']);
  assert.deepEqual(pathsOf(spec({type: 'pert', tasks: [{id: 'a', label: 'a', duration: -1}]})), ['parts[0].tasks[0].duration']);
});

test('timeline: the two forms are not mixed, dates are real and on the axis, and lanes are known', () => {
  const dated = {type: 'timeline', from: '2026-01', to: '2027-12', now: {at: '2026-10'}, deadline: {at: '2027-06', label: '期限'}};
  assert.deepEqual(validateSpec(spec(dated)), []);
  assert.deepEqual(pathsOf(spec({type: 'timeline', from: '2026-01', to: '2027-12'})), ['parts[0].now', 'parts[0].deadline']);
  assert.deepEqual(pathsOf(spec({...dated, from: '2026-13', deadline: {at: '2028-02', label: '期限'}, marks: [{at: '2026-02-30', label: 'x'}]})), ['parts[0].from', 'parts[0].deadline.at', 'parts[0].marks[0].at']);
  assert.deepEqual(pathsOf(spec({...dated, from: '2028', to: '2027'})), ['parts[0].to']);
  assert.deepEqual(pathsOf(spec({...dated, unit: 'ms', events: []})), ['parts[0].now', 'parts[0].deadline', 'parts[0].from', 'parts[0].to']);
  const numeric = {type: 'timeline', unit: 'ms', from: 0, to: 100, lanes: ['a', 'b']};
  assert.deepEqual(validateSpec(spec(numeric)), []);
  assert.deepEqual(pathsOf(spec({...numeric, events: [{at: 120, label: 'x'}, {at: 5, label: 'y', lane: 'c'}], spans: [{from: 50, to: 10}], step: 1})).sort(),
    ['parts[0].events[0].at', 'parts[0].events[1].lane', 'parts[0].spans[0].to', 'parts[0].step']);
  assert.deepEqual(pathsOf(spec({type: 'timeline', from: 0, to: 10})), ['parts[0].unit']);
  assert.deepEqual(pathsOf(spec({...numeric, lanes: ['a', 'a']})), ['parts[0].lanes']);
});

test('tree and dependencyNetwork are bounded, and their references checked', () => {
  const wide = {label: 'root', children: Array.from({length: 12}, () => ({label: 'a', children: Array.from({length: 6}, () => ({label: 'b'}))}))};
  assert.deepEqual(pathsOf(spec({type: 'tree', root: wide})), ['parts[0].root']);
  const nodes = [{id: 'a', label: 'A'}, {id: 'b', label: 'B'}];
  assert.deepEqual(pathsOf(spec({type: 'dependencyNetwork', nodes, edges: [{from: 'a', to: 'x', type: 'uses'}, {from: 'b', to: 'b', type: 'uses'}, {from: 'a', to: 'b', type: 'owns'}]})),
    ['parts[0].edges[2].type']);
  assert.deepEqual(pathsOf(spec({type: 'dependencyNetwork', nodes, edges: [{from: 'a', to: 'x', type: 'uses'}, {from: 'b', to: 'b', type: 'uses'}]})), ['parts[0].edges[0].to', 'parts[0].edges[1].to']);
  const kinded = (kinds: (string | undefined)[]) => kinds.map((kind, i) => ({id: `n${i}`, label: 'x', ...(kind ? {kind} : {})}));
  assert.deepEqual(pathsOf(spec({type: 'dependencyNetwork', nodes: kinded(['a', 'b', 'c', 'd']), edges: []})), []);
  assert.deepEqual(pathsOf(spec({type: 'dependencyNetwork', nodes: kinded(['a', 'b', 'c', 'd', 'e']), edges: []})), ['parts[0].nodes']);
  assert.deepEqual(pathsOf(spec({type: 'dependencyNetwork', nodes: kinded(['a', 'b', 'c', 'd', undefined]), edges: []})), ['parts[0].nodes']);
});

test('ids of these parts are anchors of the figure: they must not repeat between parts', () => {
  const p = {type: 'pert', tasks: [{id: 'a', label: 'A', duration: 1}]};
  const n = {type: 'dependencyNetwork', nodes: [{id: 'a', label: 'A'}], edges: []};
  assert.deepEqual(pathsOf(spec(p, n)), ['parts[1].nodes[0].id']);
});

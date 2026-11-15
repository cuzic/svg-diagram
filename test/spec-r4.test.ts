// The R4 spec parts (lib/spec-parts/r4.ts): quality, risk and problem-solving figures. A spec draws what the DSL draws, a mistake is
// reported at its place, and the words a builder writes by itself come out in English with lang: 'en'.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {bowtie, causalLoop, closeMeasurer, diagram, faultTree, isIsNot, renderDiagram} from '../lib/dsl.ts';
import {installResolveHook} from '../lib/resolve-hook.ts';
import {specToDiagram, validateSpec} from '../lib/spec.ts';
import {MAX_AFFINITY_CARDS, MAX_CAUSAL_LOOPS, MAX_FTA_EVENTS} from '../lib/spec-parts/r4.ts';
import type {Diagram} from '../lib/types/index.ts';

test.after(() => closeMeasurer());

const ROOT = path.resolve(import.meta.dirname, '..');
const svgOf = async (d: Diagram) => (await renderDiagram(d, {name: 'x.svg', budget: 'cacheOnly'})).svg;
const spec = (...parts: unknown[]) => ({version: 1, title: '例', parts});
const en = (...parts: unknown[]) => ({version: 1, title: 'Example', lang: 'en', parts});
const dsl = (band: unknown) => diagram({theme: 'blue', title: '例'}).add(band as never) as unknown as Diagram;
const pathsOf = (input: unknown) => validateSpec(input).map(i => i.path);
const messagesAt = (input: unknown, at: string) => validateSpec(input).filter(i => i.path === at).map(i => i.message);

/** Examples of the repository, and the same figures written as specs. */
const SAME_AS_EXAMPLE: Record<string, unknown> = {
  'qc-pdpc': {version: 1, title: '新製品の立ち上げ計画（PDPC）', sourceLine: '出典: 説明用の例', parts: [{type: 'pdpc', maxNodeW: 150, nodes: [
    {id: 'start', label: '設計に着手', role: 'start'}, {id: 'proto', label: '試作する'}, {id: 'test', label: '評価試験'}, {id: 'line', label: '量産ラインを準備'}, {id: 'goal', label: '量産開始', role: 'goal'},
    {id: 'r1', label: '強度が足りない', role: 'risk'}, {id: 'm1', label: '材質を変更して再試作', role: 'measure'}, {id: 'r2', label: '部品の納期が遅れる', role: 'risk'}, {id: 'm2', label: '代替の仕入先に切り替える', role: 'measure'},
  ], links: [
    {from: 'start', to: 'proto'}, {from: 'proto', to: 'test'}, {from: 'test', to: 'line'}, {from: 'line', to: 'goal'},
    {from: 'test', to: 'r1'}, {from: 'r1', to: 'm1'}, {from: 'm1', to: 'proto'}, {from: 'line', to: 'r2'}, {from: 'r2', to: 'm2'}, {from: 'm2', to: 'goal'},
  ]}]},
  'qc-relation': {version: 1, title: '納期遅れの連関図', sourceLine: '出典: 説明用の例', parts: [{type: 'relationDiagram', problem: 'late', maxNodeW: 150, nodes: [
    {id: 'late', label: '納期に遅れる'}, {id: 'rush', label: '急ぎの割り込み'}, {id: 'multi', label: '並行作業が多い'}, {id: 'sw', label: '切り替えのロス'}, {id: 'plan', label: '計画が守られない'},
    {id: 'est', label: '見積もりが甘い'}, {id: 'skill', label: '経験者に集中'}, {id: 'over', label: '残業が増える'}, {id: 'tired', label: '疲れてミスが増える'},
  ], links: [
    {from: 'rush', to: 'multi'}, {from: 'multi', to: 'sw'}, {from: 'sw', to: 'late'}, {from: 'est', to: 'plan'}, {from: 'plan', to: 'rush'},
    {from: 'est', to: 'over'}, {from: 'est', to: 'multi'}, {from: 'skill', to: 'sw'}, {from: 'skill', to: 'late'}, {from: 'over', to: 'tired'}, {from: 'tired', to: 'late'},
    {from: 'tired', to: 'plan'}, {from: 'plan', to: 'late'},
  ]}]},
  'qc-affinity': {version: 1, title: '新人の定着についての親和図', sourceLine: '出典: 説明用の例', parts: [{type: 'affinity', cols: 3, groups: [
    {title: '最初の数週間で不安になる', groups: [
      {title: '何をすればいいか分からない', cards: ['初日の予定が決まっていない', '手順書が古い']},
      {title: '聞ける人がいない', cards: ['担当者が忙しそう', '質問のしかたが分からない']},
    ]},
    {title: '仕事の意味が見えない', cards: ['全体の流れを知らない', '自分の作業が何に使われるか不明', '成果の確認がない']},
    {title: '職場に慣れにくい', cards: ['昼休みに話す相手がいない', '会議で発言しにくい']},
  ]}]},
  'qc-matrix': {version: 1, title: '改善案の評価マトリックス', sourceLine: '出典: 説明用の例', parts: [{type: 'matrix', corner: '案 ＼ 評価項目', weights: [5, 4, 3, 2],
    rows: ['A 案　治具の追加', 'B 案　作業手順の変更', 'C 案　設備の更新'], cols: ['コスト', '効果', '早さ', '現場の負担'],
    cells: [['○', '○', '◎', '△'], ['◎', '△', '◎', '○'], ['×', '◎', '△', '○']]}]},
  'fmea-basic': {version: 1, title: '搬送設備 FMEA', parts: [{type: 'fmea', title: '故障モード影響解析', sort: 'rpn', dense: true, rows: [
    {item: '駆動軸', mode: '摩耗', effect: '搬送停止', cause: '潤滑不足', action: '定期給油', s: 8, o: 5, d: 4, after: {s: 8, o: 2, d: 2}},
    {item: 'センサー', mode: '誤検知', effect: '一時停止', cause: '汚れ', action: '清掃周期短縮', s: 5, o: 4, d: 3, after: {s: 5, o: 2, d: 2}},
  ]}]},
};
for (const [name, json] of Object.entries(SAME_AS_EXAMPLE)) {
  test(`the ${name} example, written as a spec, draws the same SVG`, async () => {
    installResolveHook();
    const {default: define} = await import(path.join(ROOT, `examples/${name}.ts`)) as {default: () => Diagram};
    assert.equal(await svgOf(specToDiagram(json)), await svgOf(define()));
  });
}

test('a fault tree, a bow-tie, an IS / IS NOT table and a causal loop draw the same SVG as the DSL', async () => {
  const top = {label: 'サービス停止', gate: 'or', children: [{label: 'DB 停止', gate: 'and', children: [{id: 'm', label: '主系停止', kind: 'basic'}, {label: '切替不能', kind: 'basic'}]}, {label: '回線断', gate: 'vote', k: 2, children: [{ref: 'm'}, {label: 'A 系', kind: 'basic'}, {label: 'B 系', kind: 'basic'}]}]};
  assert.equal(await svgOf(specToDiagram(spec({type: 'faultTree', top, cutSets: true, maxNodeW: 140}))), await svgOf(dsl(faultTree(top as never, {cutSets: true, maxNodeW: 140}))));
  const bt = {hazard: '顧客データ', top: '漏えい', threats: [{label: '不正アクセス', barriers: ['多要素認証']}], consequences: [{label: '信用の低下'}]};
  assert.equal(await svgOf(specToDiagram(spec({type: 'bowtie', ...bt}))), await svgOf(dsl(bowtie(bt))));
  const rows = [{dim: 'what', is: 'API A', isNot: 'API B', distinct: 'A だけ外部 DB'}, {dim: '頻度', is: '朝', isNot: '夜'}];
  assert.equal(await svgOf(specToDiagram(spec({type: 'isIsNot', rows, dense: true}))), await svgOf(dsl(isIsNot(rows, {dense: true}))));
  const nodes = [{id: 'q', label: '品質'}, {id: 's', label: '満足'}, {id: 'l', label: '負荷'}];
  const links = [{from: 'q', to: 's', polarity: '+'}, {from: 's', to: 'l', polarity: '+', delay: true}, {from: 'l', to: 'q', polarity: '-'}] as const;
  const interventions = [{id: 'h', label: '採用', to: 'l', polarity: '-'}] as const;
  assert.equal(await svgOf(specToDiagram(spec({type: 'causalLoop', nodes, links, interventions, layout: 'ring'}))), await svgOf(dsl(causalLoop(nodes, links as never, {interventions: interventions as never, layout: 'ring'}))));
});

test('fault trees: refs, gates, votes and inhibits are checked at their place, and the size is bounded', () => {
  const ft = (top: unknown, extra: object = {}) => spec({type: 'faultTree', top, ...extra});
  assert.match(messagesAt(ft({label: 'T', gate: 'or', children: [{label: 'a', kind: 'basic'}, {ref: 'x'}]}), 'parts[0].top.children[1].ref')[0] ?? '', /not the id of an event/);
  assert.match(messagesAt(ft({label: 'T', gate: 'or', children: [{id: 'g', label: 'a', gate: 'and', children: [{label: 'b', kind: 'basic'}, {label: 'c', kind: 'basic'}]}, {ref: 'g'}]}), 'parts[0].top.children[1].ref')[0] ?? '', /has a gate under it/);
  assert.deepEqual(pathsOf(ft({label: 'T', gate: 'or', children: [{ref: 'a', label: 'x'}, {id: 'a', label: 'a', kind: 'basic'}]})), ['parts[0].top.children[0].label']);
  assert.deepEqual(pathsOf(ft({label: 'T', gate: 'or'})), ['parts[0].top.children']);
  assert.deepEqual(pathsOf(ft({label: 'T', children: [{label: 'a', kind: 'basic'}]})), ['parts[0].top.gate', 'parts[0].top.gate']);
  assert.deepEqual(pathsOf(ft({label: 'T', gate: 'vote', k: 3, children: [{label: 'a', kind: 'basic'}, {label: 'b', kind: 'basic'}]})), ['parts[0].top.k']);
  assert.deepEqual(pathsOf(ft({label: 'T', gate: 'or', children: [{label: 'a'}, {label: 'b', kind: 'basic', gate: 'and', children: [{label: 'c', kind: 'basic'}]}]})), ['parts[0].top.children[0].kind', 'parts[0].top.children[1].kind']);
  assert.deepEqual(pathsOf(ft({label: 'T', gate: 'inhibit', children: [{label: 'a', kind: 'basic'}], condition: {label: 'c', kind: 'basic'}})), ['parts[0].top.condition.kind']);
  assert.deepEqual(pathsOf(ft({label: 'T', gate: 'or', children: [{label: 'a', kind: 'basic', state: true}, {label: 'b', kind: 'basic'}]})), ['parts[0].top.children[0].state']);
  const wide = {label: 'T', gate: 'or', children: Array.from({length: 4}, (_, i) => ({label: `m${i}`, gate: 'or', children: Array.from({length: 8}, (_, j) => ({label: `b${i}${j}`, kind: 'basic'}))}))};
  assert.match(messagesAt(ft(wide), 'parts[0].top')[0] ?? '', new RegExp(`limit is ${MAX_FTA_EVENTS}`));
  assert.deepEqual(pathsOf(ft({label: 'T', gate: 'or', children: [{label: 'a', kind: 'basic'}, {label: 'b', kind: 'basic'}]}, {quantPeriod: '1 年'})), ['parts[0].quantPeriod']);
});

test('tables: a matrix is as wide as its headings, an IS / IS NOT table names a distinction', () => {
  const m = (extra: object) => spec({type: 'matrix', rows: ['A', 'B'], cols: ['x', 'y'], cells: [['◎', '○'], ['△', '×']], ...extra});
  assert.deepEqual(validateSpec(m({})), []);
  assert.deepEqual(pathsOf(m({cells: [['◎', '○'], ['△']]})), ['parts[0].cells[1]']);
  assert.deepEqual(pathsOf(m({cells: [['◎', '○']]})), ['parts[0].cells']);
  assert.deepEqual(pathsOf(m({weights: [1, 2, 3]})), ['parts[0].weights']);
  assert.deepEqual(pathsOf(m({cells: [['◎', 'O'], ['△', '×']]})), ['parts[0].cells[0][1]']);
  assert.deepEqual(pathsOf(spec({type: 'isIsNot', rows: [{dim: 'what', is: 'a', isNot: 'b'}]})), ['parts[0].rows']);
  assert.deepEqual(pathsOf(spec({type: 'fmea', rows: [{item: 'a', mode: 'b', effect: 'c', cause: 'd', action: 'e', s: 11, o: 1, d: 1}]})), ['parts[0].rows[0].s']);
});

test('graphs: unknown ids, repeated links, a PDPC without a goal, too many loops and a lever named like a node', () => {
  const pd = spec({type: 'pdpc', nodes: [{id: 'a', label: 'A', role: 'start'}, {id: 'b', label: 'B'}], links: [{from: 'a', to: 'c'}]});
  assert.deepEqual(pathsOf(pd), ['parts[0].links[0].to', 'parts[0].nodes']);
  const rd = (extra: object) => spec({type: 'relationDiagram', problem: 'a', nodes: [{id: 'a', label: 'A'}, {id: 'b', label: 'B'}], links: [{from: 'b', to: 'a'}], ...extra});
  assert.deepEqual(validateSpec(rd({})), []);
  assert.deepEqual(pathsOf(rd({problem: 'z'})), ['parts[0].problem']);
  assert.deepEqual(pathsOf(rd({problem: ['a', 'z']})), ['parts[0].problem[1]']);
  assert.deepEqual(pathsOf(rd({links: [{from: 'b', to: 'a'}, {from: 'b', to: 'a'}]})), ['parts[0].links[1]']);
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const four = ids.slice(0, 4), complete = four.flatMap(f => four.filter(t => t !== f).map(t => ({from: f, to: t, polarity: '+'}))); // 20 loops
  assert.match(messagesAt(spec({type: 'causalLoop', nodes: ids.map(id => ({id, label: id})), links: complete}), 'parts[0].links')[0] ?? '', new RegExp(`more than ${MAX_CAUSAL_LOOPS} loops`));
  const cl = spec({type: 'causalLoop', nodes: [{id: 'a', label: 'A'}, {id: 'b', label: 'B'}], links: [{from: 'a', to: 'b', polarity: '+'}, {from: 'b', to: 'a', polarity: '-'}], interventions: [{id: 'a', label: 'L', to: ['b', 'z'], polarity: '+'}]});
  assert.deepEqual(pathsOf(cl), ['parts[0].interventions[0].id', 'parts[0].interventions[0].to[1]']);
});

test('affinity groups hold cards or groups, and the cards are bounded', () => {
  assert.deepEqual(pathsOf(spec({type: 'affinity', groups: [{title: 'a', cards: ['x']}, {title: 'b', groups: [{title: 'c'}]}]})), ['parts[0].groups[1].groups[0].cards']);
  const many = Array.from({length: 5}, (_, g) => ({title: `g${g}`, cards: Array.from({length: 9}, (_, c) => `c${g}${c}`)}));
  assert.match(messagesAt(spec({type: 'affinity', groups: many}), 'parts[0].groups')[0] ?? '', new RegExp(`limit is ${MAX_AFFINITY_CARDS}`));
});

test('in English, the words the builders write come out in English, and the fault-tree badges and probability note too', async () => {
  const text = async (input: unknown) => (await svgOf(specToDiagram(input))).replace(/<[^>]+>/g, ' ');
  const matrixText = await text(en({type: 'matrix', rows: ['A', 'B'], cols: ['x', 'y'], cells: [['◎', '○'], ['△', '×']], weights: [2, 1]}));
  assert.match(matrixText, /Weight/); assert.match(matrixText, /Score/); assert.doesNotMatch(matrixText, /重み|評価点/);
  const relationText = await text(en({type: 'relationDiagram', problem: 'a', nodes: [{id: 'a', label: 'Late'}, {id: 'b', label: 'Rush'}], links: [{from: 'b', to: 'a'}]}));
  assert.match(relationText, /Out 1/); assert.doesNotMatch(relationText, /出|入/);
  const isText = await text(en({type: 'isIsNot', rows: [{dim: 'when', is: 'Mondays', isNot: 'Other days', distinct: 'After the batch'}]}));
  assert.match(isText, /Distinction/); assert.match(isText, /When/); assert.doesNotMatch(isText, /[ぁ-んァ-ン一-龥]/);
  const fmeaText = await text(en({type: 'fmea', rows: [{item: 'Motor', mode: 'Heat', effect: 'Stop', cause: 'Dust', action: 'Clean', s: 5, o: 5, d: 5}]}));
  assert.doesNotMatch(fmeaText, /[ぁ-んァ-ン一-龥]/);
  const house = {label: 'Top', gate: 'and', children: [{label: 'Power cut', kind: 'basic'}, {label: 'Maintenance', kind: 'house', state: true}]};
  const input = en({type: 'faultTree', top: house});
  const before = JSON.stringify(input);
  assert.match(await text(input), /Assumed to always\s+happen/);
  assert.equal(JSON.stringify(input), before, 'the input is not changed');
  const quantTree = {label: 'Top', gate: 'or', children: [{label: 'Power cut', kind: 'basic', p: 0.01}, {label: 'Network', kind: 'undeveloped', p: 0.02}, {label: 'Maintenance', kind: 'house', state: false}]};
  const ftaText = await text(en({type: 'faultTree', top: quantTree, cutSets: true, quant: true, quantPeriod: '1 year'}));
  for (const w of [/Single point of\s+failure/, /Undeveloped, alone/, /Period: 1 year/, /Probability of the top event/, /assumed\s+independent/, /Assumed never/]) assert.match(ftaText, w);
  assert.doesNotMatch(ftaText, /[\u3000-\u30ff\u3400-\u9fff\uff00-\uffef]/);
  assert.deepEqual(pathsOf(spec({type: 'faultTree', top: house, words: {singlePoint: 'x'}})), ['parts[0].words'], 'the words are not part of the schema');
  assert.deepEqual(pathsOf(spec({type: 'faultTree', top: house, lang: 'en'})), ['parts[0].lang'], 'a part does not take lang from the caller');
});

test('the affinity columns default to the number of groups, up to three', async () => {
  const groups = [{title: 'a', cards: ['x']}, {title: 'b', cards: ['y']}];
  const two = await svgOf(specToDiagram(spec({type: 'affinity', groups})));
  assert.equal(two, await svgOf(specToDiagram(spec({type: 'affinity', groups, cols: 2}))));
});

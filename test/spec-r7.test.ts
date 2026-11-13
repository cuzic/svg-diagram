// The R7 spec parts (lib/spec-parts/r7.ts): quality function deployment and the why-why table. A spec draws what the DSL draws, a
// mistake is reported at its place, and the words the builders write by themselves come out in English with lang: 'en'. Also here:
// the bpmn lane-name column is never narrower than the longest word of a lane name.
import test from 'node:test';
import assert from 'node:assert/strict';
import {closeMeasurer, diagram, qfd, renderDiagram, whyWhyTable} from '../lib/dsl.ts';
import {specToDiagram, validateSpec} from '../lib/spec.ts';
import {renderSpec} from '../lib/spec-render.ts';
import {MAX_WHY_CHAINS} from '../lib/spec-parts/r7.ts';
import type {Diagram} from '../lib/types/index.ts';

test.after(() => closeMeasurer());

const svgOf = async (d: Diagram) => (await renderDiagram(d, {name: 'x.svg', budget: 'cacheOnly'})).svg;
const spec = (...parts: unknown[]) => ({version: 1, title: '例', parts});
const en = (...parts: unknown[]) => ({version: 1, title: 'Example', lang: 'en', parts});
const dsl = (band: unknown) => diagram({theme: 'blue', title: '例'}).add(band as never) as unknown as Diagram;
const pathsOf = (input: unknown) => validateSpec(input).map(i => i.path);
const textOf = async (input: unknown) => (await svgOf(specToDiagram(input))).replace(/<(?:title|desc)[^>]*>|<\/(?:title|desc)>/g, ' ').replace(/<[^>]+?(?:aria-label="([^"]*)")?[^>]*>/g, ' $1 ');
const JAPANESE = /[　-ヿ㐀-鿿＀-￯]/;

const demands = [{label: '持ちやすい', importance: 5}, {label: '電池が長持ち', importance: 4}];
const chains = [{whys: ['修正に時間がかかった', '検証が最後に集中していた'], trueCause: '検証を早くしていない', measure: '結合テストを毎週回す'}, {whys: ['担当が 1 人'], trueCause: '権限の集中', measure: '確認を分ける'}];

test('a qfd and a why-why table spec draw the same SVG as the DSL', async () => {
  const relations = [['◎', '△', ''], ['△', '◎', '○']];
  assert.equal(await svgOf(specToDiagram(spec({type: 'qfd', demands, characteristics: ['重さ', '電池容量', '部品点数'], relations, corner: '要求 ＼ 特性', title: 'QFD'}))),
    await svgOf(dsl(qfd(demands, ['重さ', '電池容量', '部品点数'], relations as never, {corner: '要求 ＼ 特性', title: 'QFD'}))));
  assert.equal(await svgOf(specToDiagram(spec({type: 'qfd', demands, characteristics: ['重さ', '電池容量', '部品点数'], relations, highlight: false}))),
    await svgOf(dsl(qfd(demands, ['重さ', '電池容量', '部品点数'], relations as never, {highlight: false}))));
  assert.equal(await svgOf(specToDiagram(spec({type: 'whyWhyTable', problem: 'リリースが遅れた', chains, title: 'なぜなぜ'}))), await svgOf(dsl(whyWhyTable('リリースが遅れた', chains, {title: 'なぜなぜ'}))));
});

test('qfd and why-why mistakes are reported at their place', () => {
  const q = (p: Record<string, unknown>) => pathsOf(spec({type: 'qfd', demands, characteristics: ['a', 'b'], relations: [['◎', ''], ['', '○']], ...p}));
  assert.deepEqual(q({}), []);
  assert.deepEqual(q({relations: [['◎', '']]}), ['parts[0].relations']);
  assert.deepEqual(q({relations: [['◎', ''], ['○']]}), ['parts[0].relations[1]']);
  assert.deepEqual(q({relations: [['◎', 'x'], ['', '○']]}), ['parts[0].relations[0][1]']);
  assert.deepEqual(q({demands: [{label: 'a', importance: -1}, {label: 'b', importance: 3}]}), ['parts[0].demands[0].importance']);
  assert.deepEqual(q({labels: {score: 'x'}}), ['parts[0].labels'], 'the words are not part of the schema');
  const w = (c: unknown[]) => pathsOf(spec({type: 'whyWhyTable', problem: 'p', chains: c}));
  assert.deepEqual(w([{whys: ['a'], measure: 'm'}]), ['parts[0].chains[0].measure']);
  assert.deepEqual(w([{whys: []}]), ['parts[0].chains[0].whys']);
  assert.deepEqual(w(Array.from({length: MAX_WHY_CHAINS + 1}, () => ({whys: ['a']}))), ['parts[0].chains']);
});

test('in English, the qfd and why-why headings are English, and the Japanese defaults are unchanged', async () => {
  const qfdEn = await textOf(en({type: 'qfd', demands: [{label: 'Light', importance: 5}], characteristics: ['Weight'], relations: [['◎']]}));
  for (const w of ['Customer demand', 'Importance', 'Score', 'Relative %']) assert.ok(qfdEn.includes(w), w);
  assert.doesNotMatch(qfdEn, JAPANESE);
  const whyEn = await textOf(en({type: 'whyWhyTable', problem: 'Late', chains: [{whys: ['Slow review', 'One reviewer'], trueCause: 'Rights in one place', measure: 'Share them'}]}));
  for (const w of ['Problem', 'Why 1', 'Why 2', 'Root cause', 'Measure']) assert.ok(whyEn.includes(w), w);
  assert.doesNotMatch(whyEn, JAPANESE);
  const qfdJa = await textOf(spec({type: 'qfd', demands, characteristics: ['重さ', '電池容量'], relations: [['◎', ''], ['', '○']]}));
  for (const w of ['要求品質', '重要度', '得点', '相対 %']) assert.ok(qfdJa.includes(w), w);
});

test('a bpmn lane-name column is as wide as the longest word of a lane name, also when the figure is shrunk', async () => {
  const lanes = [{id: 'p', label: 'Purchasing'}, {id: 'w', label: 'Warehouse'}, {id: 'q', label: 'Accounting'}];
  const nodes = [{id: 's', lane: 'p', kind: 'start', label: 'Request'}, ...Array.from({length: 6}, (_, i) => ({id: `t${i}`, lane: ['p', 'w', 'q'][i % 3], label: `Check the order ${i + 1}`})), {id: 'e', lane: 'q', kind: 'end'}];
  const ids = ['s', ...nodes.slice(1, -1).map(n => n.id), 'e'];
  const r = await renderSpec(en({type: 'bpmn', lanes, nodes, flows: ids.slice(1).map((to, i) => ({from: ids[i], to}))}), {config: {measure: 'font'}});
  assert.equal(r.ok, true, JSON.stringify(r.issues));
  assert.deepEqual([...r.problems, ...r.findings].map(f => f.message).filter(m => /Purchasing|Warehouse|Accounting/.test(m)), []);
});

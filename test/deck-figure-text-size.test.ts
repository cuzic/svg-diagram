// ADR 0085 D1 (U1): a deck figure whose smallest text comes to under 14 px on the slide is a warning, whatever the slide's own text is,
// and the advice depends on what makes the text small. renderDeck (serve / site) and the edge writer (pptx-deck) say the same.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {configureMeasure} from '../lib/measure.ts';
import {installResolveHook} from '../lib/resolve-hook.ts';
import {loadDeck} from '../lib/deck-load.ts';
import {renderDeck} from '../lib/present/render-deck.ts';
import {renderDeckPptxEdgeWith} from '../lib/pptx-deck-edge-core.ts';
import {planFigureEdge} from '../lib/pptx-edge.ts';
import {validateDeck} from '../lib/deck-spec.ts';
import {figurePartTypes, MIN_FIGURE_TEXT_PX, smallTextWarning} from '../lib/deck-layout.ts';
import {closeMeasurer} from '../lib/dsl.ts';
import type {Config} from '../lib/types/project.ts';
import {JA_FONTS, realEngine} from './helpers/text-engine.ts';

const cfg: Config = {measure: 'font', fonts: JA_FONTS};
installResolveHook();
configureMeasure(cfg);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-text-size-'));
test.after(async () => { fs.rmSync(tmp, {recursive: true, force: true}); await closeMeasurer(); });

const named = (...names: string[]) => names.map(label => ({label}));
const parts: Record<string, object> = {
  venn: {type: 'venn', sets: [{name: '調達'}, {name: '製造'}, {name: '販売'}], overlaps: [{sets: ['調達', '製造'], label: '品質'}, {sets: ['製造', '販売'], label: '納期'}, {sets: ['調達', '販売'], label: '価格'}], universe: '会社'},
  cycle: {type: 'cycle', steps: named('計画を立てる', '実行する', '結果を確認', '改善を決める', '全体へ共有', '定着させる'), centre: '改善'},
  versus: {type: 'versus', left: {title: '前', tone: 'muted', items: [1, 2, 3, 4, 5].map(i => ({title: `紙で申請する${i}`, body: '承認まで三日かかる'}))}, right: {title: '後', tone: 'accent', items: [1, 2, 3, 4, 5].map(i => ({title: `画面で申請する${i}`, body: '当日中に承認される'}))}},
  mindmap: {type: 'mindmap', root: {label: '在庫', children: [{label: '目的', children: [{label: '時間を半分に'}]}, {label: '機能', children: [{label: '読み取り'}]}]}},
  chevron: {type: 'chevron', steps: ['計画', '設計', '実装', '検証'].map(label => ({label, sub: '要件を確認'})), current: 2},
  table: {type: 'table', rowHeader: true, columns: [{label: '項目'}, {label: '甲'}, {label: '乙'}], rows: [['月額', '980', '9,800'], ['人数', '1', '10']]},
};
const figure = (part: object) => ({version: 1, title: 'f', showTitle: false, parts: [part]});
const crowded = {lead: '本文のリード文です。', callouts: [{label: '要点', text: '各段階の終わりに確認を入れる。'}]};

async function warningsOf(name: string, extra: object = crowded): Promise<string[]> {
  const file = path.join(tmp, `${name}-${Object.keys(extra).length}.json`);
  fs.writeFileSync(file, JSON.stringify({slides: [{title: '見出し', ...extra, figure: figure(parts[name]!)}]}));
  const r = loadDeck(file);
  assert.ok(r.ok);
  const out = await renderDeck(r.loaded, cfg);
  assert.deepEqual(out.errors, []);
  return out.warnings;
}

test('renderDeck: a venn, a cycle and a long versus come to under 14 px on a slide with a callout, and warn (they did not before)', async () => {
  for (const name of ['venn', 'cycle', 'versus']) {
    const w = await warningsOf(name);
    assert.equal(w.length, 1, `${name}: ${JSON.stringify(w)}`);
    assert.match(w[0]!, /^slides\[0\]\.figure: figure text is ~1[0-3]\.\d+px on the slide \(under 14px/, name);
  }
});

test('renderDeck: the control parts (mindmap, chevron, table) do not warn', async () => {
  for (const name of ['mindmap', 'chevron', 'table']) assert.deepEqual(await warningsOf(name), [], name);
});

test('renderDeck: a slide with no lead and no callout is checked too (the threshold is not relative to the slide text)', async () => {
  const w = await warningsOf('venn', {source: '出典の注記。'.repeat(60)});
  assert.equal(w.length, 1, JSON.stringify(w));
  assert.match(w[0]!, /^slides\[0\]\.figure: figure text is ~/);
});

test('renderDeck: the advice follows the cause (circles: more height; stacked rows: cut items)', async () => {
  assert.match((await warningsOf('venn'))[0]!, /give the figure more height \(fewer callouts, or put it in a column beside the text\)$/);
  assert.match((await warningsOf('cycle'))[0]!, /give the figure more height/);
  assert.match((await warningsOf('versus'))[0]!, /cut items, or split the figure over two slides$/);
});

test('the edge writer (pptx-deck) warns the same way, with the same advice', async () => {
  const real = {validate: (i: unknown) => validateDeck(i), plan: (spec: unknown, engine: Parameters<typeof planFigureEdge>[1], width?: number) => planFigureEdge(spec, engine, {}, width)};
  const r = await renderDeckPptxEdgeWith({slides: [{title: '見出し', ...crowded, figure: figure(parts['venn']!)}]}, realEngine(), {rasterize: () => new Uint8Array([0])}, real);
  assert.deepEqual(r.issues, []);
  const w = r.warnings.filter(x => x.path === 'slides[0].figure');
  assert.equal(w.length, 1, JSON.stringify(r.warnings));
  assert.match(w[0]!.message, /^figure text is ~1[0-3]\.\d+px on the slide \(under 14px.*give the figure more height/);
  const c = await renderDeckPptxEdgeWith({slides: [{title: '見出し', ...crowded, figure: figure(parts['table']!)}]}, realEngine(), {rasterize: () => new Uint8Array([0])}, real);
  assert.deepEqual(c.warnings, []);
});

test('smallTextWarning: 14 px is the line (10.5 pt); the 9 pt message is unchanged and comes first', () => {
  assert.equal(MIN_FIGURE_TEXT_PX, 14);
  assert.equal(smallTextWarning({scale: 1, minTextPt: 10.5}), null);
  assert.equal(smallTextWarning({scale: 1.2, minTextPt: 12}), null);
  assert.match(smallTextWarning({scale: 0.9, minTextPt: 10.4, parts: ['venn']}) ?? '', /^figure text is ~13\.9px on the slide \(under 14px, the size it is drawn at before scaling\), scaled to 90% to fit the slide: give the figure more height/);
  assert.equal(smallTextWarning({scale: 0.6, minTextPt: 8, sourceLines: 0}), 'scaled to 60% to fit the slide, its smallest text is 8.0pt (under 9pt): split the figure, or move text off the slide');
  assert.equal(smallTextWarning({scale: null, minTextPt: 8}), null);
  assert.equal(smallTextWarning({scale: 1, minTextPt: null}), null);
});

test('smallTextWarning: advice for circles, for rows, for both, and for a figure with no part types', () => {
  const at = (parts: string[]) => smallTextWarning({scale: 0.9, minTextPt: 9.5, parts}) ?? '';
  assert.match(at(['cycle', 'venn']), /: give the figure more height \(fewer callouts, or put it in a column beside the text\)$/);
  assert.match(at(['sequence']), /: cut items, or split the figure over two slides$/);
  assert.match(at(['concentric', 'tree']), /more height .*; for the other parts, cut items/);
  assert.match(at([]), /: give the figure more room, cut items, or split it over two slides$/);
});

test('figurePartTypes: the part types of a spec; nothing for a file name or a malformed value', () => {
  assert.deepEqual(figurePartTypes({parts: [{type: 'venn'}, {type: 'table'}, {nope: 1}, null]}), ['venn', 'table']);
  assert.deepEqual(figurePartTypes('fig.diagram.ts'), []);
  assert.deepEqual(figurePartTypes({parts: 3}), []);
  assert.deepEqual(figurePartTypes(undefined), []);
});

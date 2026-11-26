// B6: a flowchart in one row on a slide is judged against the slide's room, not the document's 900px (ADR 0060 D1, wide rooms).
// A document figure is unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {configureMeasure} from '../lib/measure.ts';
import {installResolveHook} from '../lib/resolve-hook.ts';
import {loadDeck} from '../lib/deck-load.ts';
import {renderDeck} from '../lib/present/render-deck.ts';
import {renderSpec} from '../lib/spec-render.ts';
import {renderDeckPptxEdgeWith} from '../lib/pptx-deck-edge-core.ts';
import {planFigureEdge} from '../lib/pptx-edge.ts';
import {validateDeck} from '../lib/deck-spec.ts';
import {fillSearch, wideWidths, widenDiagram} from '../lib/deck-layout.ts';
import {closeMeasurer} from '../lib/dsl.ts';
import type {Config} from '../lib/types/project.ts';
import {JA_FONTS, realEngine} from './helpers/text-engine.ts';

const cfg: Config = {measure: 'font', fonts: JA_FONTS};
installResolveHook();
configureMeasure(cfg);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-wide-flow-'));
test.after(async () => { fs.rmSync(tmp, {recursive: true, force: true}); await closeMeasurer(); });

const steps = ['資料の受け取り作業', '内容の確認と整理', '担当者への連絡', '作業の実施と記録', '結果の取りまとめ'];
const figure = (dir?: 'right' | 'auto') => ({version: 1, title: 'f', showTitle: false, parts: [{type: 'flowchart', ...(dir ? {dir} : {}),
  nodes: steps.map((label, i) => ({id: `n${i}`, label})), edges: steps.slice(1).map((_, i) => ({from: `n${i}`, to: `n${i + 1}`}))}]});
/** A lead and two callouts take the slide's height: the room left for the figure is wide and short. */
const crowded = {lead: '五つの段階を順に進める。各段階で確認を入れる。', callouts: [{label: '要点', text: '各段階の終わりに確認を入れる。'}, {label: '注意', text: '抜けがあれば前の段階へ戻る。'}]};

/** The figure as the slide draws it: its layout size, and its smallest text on the 1280x720 slide (the flowchart's 14px text times the figure's scale). */
async function onSlide(dir: 'right' | 'auto', extra: object = {}): Promise<{errors: string[]; layout: {w: number; h: number} | null; textPx: number}> {
  const file = path.join(tmp, `${dir}-${Object.keys(extra).length}.json`);
  fs.writeFileSync(file, JSON.stringify({slides: [{title: '手順の流れ', ...extra, figure: figure(dir)}]}));
  const r = loadDeck(file);
  assert.ok(r.ok);
  const out = await renderDeck(r.loaded, cfg);
  const m = /<svg viewBox="0 0 ([\d.]+) ([\d.]+)" x="[\d.]+" y="[\d.]+" width="([\d.]+)"/.exec(out.slides[0]?.svg ?? '');
  return {errors: out.errors, layout: m ? {w: Number(m[1]), h: Number(m[2])} : null, textPx: m ? 14 * Number(m[3]) / Number(m[1]) : 0};
}

test('renderDeck: dir right with five wide boxes is laid out against the slide, not 900px', async () => {
  const row = await onSlide('right');
  assert.deepEqual(row.errors, []);
  assert.ok(row.layout && row.layout.h < 100 && row.layout.w > 940, JSON.stringify(row.layout));
  assert.ok(row.textPx >= 14, `${row.textPx}px`);
});

test('renderDeck: dir auto takes the one row when the room is short and wide (the stacked figure shrank to 12.5px)', async () => {
  const auto = await onSlide('auto', crowded);
  assert.deepEqual(auto.errors, []);
  assert.ok(auto.layout && auto.layout.h < 100, `a row: ${JSON.stringify(auto.layout)}`);
  assert.ok(auto.textPx >= 15, `${auto.textPx}px`);
});

test('renderDeck: dir auto stays stacked where that draws the text larger (a tall room)', async () => {
  const auto = await onSlide('auto');
  assert.ok(auto.layout && auto.layout.h > 400, JSON.stringify(auto.layout));
  assert.ok(auto.textPx >= 15.5, `${auto.textPx}px`);
});

test('the pptx edge writer takes the same wide layout (dir right)', async () => {
  const real = {validate: (i: unknown) => validateDeck(i), plan: (spec: unknown, engine: Parameters<typeof planFigureEdge>[1], width?: number) => planFigureEdge(spec, engine, {}, width)};
  const r = await renderDeckPptxEdgeWith({slides: [{title: '手順の流れ', figure: figure('right')}]}, realEngine(), {rasterize: () => new Uint8Array([0])}, real);
  assert.deepEqual(r.issues, []);
  assert.ok(r.pptx);
});

test('a document figure is unchanged: the same spec still does not fit 900px with dir right', async () => {
  const r = await renderSpec(figure('right'), {config: cfg});
  assert.match(JSON.stringify(r), /does not fit 900px/);
});

test('wideWidths: only widths past 940 that the room holds', () => {
  assert.deepEqual(wideWidths(940), []);
  assert.deepEqual(wideWidths(700), []);
  assert.deepEqual(wideWidths(1168), [1056, 1168]);
  assert.deepEqual(wideWidths(1000), [1000]);
});

test('fillSearch: a figure that fails at 940 is tried wider; one held back by its height is taken wider only when larger', async () => {
  const widths: (number | null)[] = [];
  const failing = await fillSearch({w: 1168, h: 400}, 1.5, async w => { widths.push(w); return w !== null && w >= 1100 ? {ok: true, w, h: 80, value: w, flags: []} : {ok: false, why: 'no'}; });
  assert.ok(failing.ok && failing.width === 1168, JSON.stringify(failing));
  // tall at 940 (k 0.8), flat when wider (k 1.1)
  const tall = await fillSearch({w: 1168, h: 400}, 1.5, async w => w === null ? {ok: true, w: 940, h: 500, value: 'tall', flags: []} : {ok: true, w, h: 80, value: 'flat', flags: []});
  assert.ok(tall.ok && tall.value === 'flat');
  // the wide layout is not larger: kept as it is
  const same = await fillSearch({w: 1168, h: 400}, 1.5, async w => w === null ? {ok: true, w: 940, h: 500, value: 'first', flags: []} : {ok: true, w, h: 500, value: 'wide', flags: []});
  assert.ok(same.ok && same.value === 'first');
  // a wider layout that raises a new check is not taken
  const flagged = await fillSearch({w: 1168, h: 400}, 1.5, async w => w === null ? {ok: true, w: 940, h: 500, value: 'tall', flags: []} : {ok: true, w, h: 80, value: 'flat', flags: ['text-mid-word-break']});
  assert.ok(flagged.ok && flagged.value === 'tall');
  // a room no wider than 940 never tries a wider layout
  const narrow = await fillSearch({w: 900, h: 400}, 1.5, async w => { assert.ok(w === null || w < 940); return {ok: true, w: 940, h: 500, value: 'tall', flags: []}; });
  assert.ok(narrow.ok);
});

test('widenDiagram: raises the width and the doc-width threshold together; nothing without a width', () => {
  const d = {width: 940, maxWidth: 940};
  assert.equal(widenDiagram(d), d);
  assert.deepEqual(d, {width: 940, maxWidth: 940});
  assert.deepEqual(widenDiagram({width: 940}, 1100), {width: 1100, maxWidth: 1100});
  assert.equal(widenDiagram({width: 940, maxWidth: 1400}, 1100).maxWidth, 1400);
});

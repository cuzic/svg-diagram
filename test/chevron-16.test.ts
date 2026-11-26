// B4: a chevron takes up to 16 steps (wrapped with rows / perRow); 16 steps on a 16:9 slide stay readable.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {closeMeasurer} from '../lib/dsl.ts';
import {configureMeasure} from '../lib/measure.ts';
import {renderDeck} from '../lib/present/render-deck.ts';
import {loadDeck} from '../lib/deck-load.ts';
import {specToDiagram} from '../lib/spec.ts';
import {JA_FONTS} from './helpers/text-engine.ts';

const cfg = {measure: 'font' as const, fonts: JA_FONTS};
configureMeasure(cfg);
test.after(() => closeMeasurer());

const steps = (n: number, ja: boolean) => Array.from({length: n}, (_, i) => ({label: ja ? `工程${i + 1}` : `Stage ${i + 1}`, sub: ja ? '確認する' : 'check it'}));
const fig = (n: number, extra: object = {}, ja = true) => ({version: 1, title: 't', parts: [{type: 'chevron', steps: steps(n, ja), ...extra}]});

test('a chevron of 16 steps is accepted, 17 is not', () => {
  assert.doesNotThrow(() => specToDiagram(fig(16, {rows: 'auto'})));
  assert.doesNotThrow(() => specToDiagram(fig(13, {rows: 3})));
  assert.throws(() => specToDiagram(fig(17, {rows: 'auto'})));
  assert.throws(() => specToDiagram(fig(16, {current: 17, rows: 'auto'})));
  assert.doesNotThrow(() => specToDiagram(fig(16, {current: 16, rows: 'auto'})));
});

test('16 steps with rows: auto draw on a 16:9 slide without errors (Japanese and Latin), in at most 4 rows', async () => {
  for (const ja of [true, false]) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chev16-')), file = path.join(dir, 'deck.json');
    fs.writeFileSync(file, JSON.stringify({slides: [{title: 'S', figure: fig(16, {rows: 'auto'}, ja)}]}));
    const r = loadDeck(file);
    assert.ok(r.ok);
    const out = await renderDeck(r.loaded, cfg);
    fs.rmSync(dir, {recursive: true, force: true});
    assert.deepEqual(out.errors, [], `ja=${ja}`);
    const svg = String((out.slides[0] as {svg?: string}).svg ?? '');
    const arrows = (svg.match(/marker-end/g) ?? []).length;
    assert.ok(arrows >= 1 && arrows <= 3, `row-continuation arrows: ${arrows}`);
    assert.ok(svg.includes(ja ? '工程16' : 'Stage 16'));
  }
});

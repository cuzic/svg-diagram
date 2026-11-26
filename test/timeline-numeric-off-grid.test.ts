// A numeric timeline whose `to` (or auto-step ticks) are not on the drawn tick grid still measures every text it draws.
import test from 'node:test';
import assert from 'node:assert/strict';
import {checkDiagram, closeMeasurer, diagram, timeline} from '../lib/dsl.ts';
import {specToDiagram} from '../lib/spec.ts';
import {configureMeasure} from '../lib/measure.ts';
import {renderDeck} from '../lib/present/render-deck.ts';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {loadDeck} from '../lib/deck-load.ts';
import {JA_FONTS} from './helpers/text-engine.ts';
import type {LaidOutTimeline, NumericTimelineOpts} from '../lib/dsl.ts';

const cfg = {measure: 'font' as const, fonts: JA_FONTS};
configureMeasure(cfg);
test.after(() => closeMeasurer());

const base = {unit: '', lanes: ['X', 'Y'], events: [{at: 2010, label: 'go', lane: 'X'}]};
const laid = async (o: NumericTimelineOpts, width?: number) => {
  const r = await checkDiagram(diagram({theme: 'blue', title: 't', ...(width ? {width} : {})}).add(timeline(o)));
  return r.laidOut.laidOut.find((x): x is LaidOutTimeline => x.type === 'timeline')!;
};
const labels = (t: LaidOutTimeline): string[] => t.texts.map(x => x.text);

test('numeric timeline: `to` off the step grid draws (DSL)', async () => {
  const t = await laid({...base, from: 2008, to: 2027, step: 2});
  assert.ok(labels(t).includes('2026'));
});

test('numeric timeline: `to` off the step grid draws (JSON spec)', async () => {
  const spec = {version: 1, title: 't', parts: [{type: 'timeline', ...base, from: 2008, to: 2027, step: 2}]};
  const r = await checkDiagram(specToDiagram(spec));
  assert.ok(r.laidOut.laidOut.some(x => x.type === 'timeline'));
});

test('numeric timeline: `to` off the step grid draws (renderDeck)', async () => {
  const fig = {version: 1, title: 't', parts: [{type: 'timeline', ...base, from: 2008, to: 2027, step: 2}]};
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-off-grid-')), file = path.join(dir, 'deck.json');
  fs.writeFileSync(file, JSON.stringify({slides: [{title: 'S', figure: fig}]}));
  const r = loadDeck(file);
  assert.ok(r.ok);
  const out = await renderDeck(r.loaded, cfg);
  fs.rmSync(dir, {recursive: true, force: true});
  assert.deepEqual(out.errors, []);
  assert.ok(out.slides[0]);
});

test('numeric timeline: from off the grid, decimals, wide step, auto step all draw', async () => {
  for (const o of [
    {from: 2007, to: 2027, step: 2}, {from: 0, to: 1.05, step: 0.2}, {from: 0, to: 100, step: 30}, {from: 3, to: 977}, {from: 0, to: 1234567}, {from: 0, to: 0.7},
  ]) for (const width of [undefined, 600, 1400]) {
    const t = await laid({unit: 'ms', ...o}, width);
    assert.ok(t.ticks.length >= 1, JSON.stringify(o));
  }
});

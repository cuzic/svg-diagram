// A numeric timeline staggers close event labels over rows instead of refusing; the date timeline does the same for its flags.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {checkDiagram, closeMeasurer, diagram, timeline} from '../lib/dsl.ts';
import {configureMeasure} from '../lib/measure.ts';
import {renderDeck} from '../lib/present/render-deck.ts';
import {loadDeck} from '../lib/deck-load.ts';
import {JA_FONTS} from './helpers/text-engine.ts';
import type {LaidOutTimeline, NumericTimelineOpts, TimelineOpts} from '../lib/dsl.ts';

const cfg = {measure: 'font' as const, fonts: JA_FONTS};
configureMeasure(cfg);
test.after(() => closeMeasurer());

const LONG_A = 'Pilot line opened at 4 sites', LONG_B = 'Rollout finished at all sites';
const REPRO: NumericTimelineOpts = {
  unit: '', from: 2008, to: 2027, step: 2, lanes: ['Product line', 'Support'],
  events: [{at: 2023, label: LONG_A, lane: 'Product line'}, {at: 2026, label: LONG_B, lane: 'Product line'}],
  spans: [{from: 2010, to: 2020, label: 'Phase one', lane: 'Support'}],
};
const laid = async (o: NumericTimelineOpts | TimelineOpts, width?: number) => {
  const r = await checkDiagram(diagram({theme: 'blue', title: 't', ...(width ? {width} : {})}).add(timeline(o as never)));
  return {t: r.laidOut.laidOut.find((x): x is LaidOutTimeline => x.type === 'timeline')!, verdict: r.verdict};
};
const clean = (v: {ok: boolean; problems: string[]; warnings: string[]}): void => assert.ok(v.ok && v.problems.length === 0 && v.warnings.length === 0, [...v.problems, ...v.warnings].join('\n'));
/** No two label boxes overlap, and no stem runs through a label box of another event. */
const noClash = (t: LaidOutTimeline): void => {
  const b = t.labelBoxes;
  for (const [i, p] of b.entries()) for (const q of b.slice(i + 1)) {
    const hit = p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;
    assert.ok(!hit, `label boxes overlap: "${p.label}" / "${q.label}"`);
  }
  for (const s of t.stems) for (const l of b) {
    const own = t.texts.some(x => x.text === l.label && x.part === s.part);
    if (own || l.y > s.y2 || l.y + l.h < s.y1) continue;
    assert.ok(!(s.x > l.x && s.x < l.x + l.w) || l.y >= s.y2 || l.y + l.h <= s.y1, `stem crosses "${l.label}"`);
  }
};

test('numeric timeline: two long event labels 3 units apart near the axis end stagger instead of refusing (repro)', async () => {
  const {t, verdict} = await laid(REPRO);
  clean(verdict);
  noClash(t);
  assert.equal(t.dots.length, 2);
  assert.equal(new Set(t.stems.map(s => s.y1)).size, 2, 'the two labels sit on different rows');
});

test('numeric timeline: a dense cluster of 3 to 5 close events stacks on rows, nothing overlaps', async () => {
  for (const n of [3, 4, 5]) {
    const events = Array.from({length: n}, (_, i) => ({at: 2020 + i, label: `Milestone ${'x'.repeat(14 + i)} reached`}));
    const {t, verdict} = await laid({unit: '', from: 2008, to: 2027, step: 2, events});
    clean(verdict);
    noClash(t);
    assert.equal(t.dots.length, n);
  }
});

test('numeric timeline: still refuses, and says how to fix it, when even staggering cannot fit', async () => {
  const events = Array.from({length: 8}, (_, i) => ({at: 2020 + i * 0.1, label: `Long milestone label number ${i} ${'y'.repeat(30)}`}));
  await assert.rejects(laid({unit: '', from: 2008, to: 2027, step: 2, events}), /do not fit above the lane.*(shorten|widen)/);
});

test('numeric timeline: the existing greedy layout is kept when it fits (events far apart stay on one row)', async () => {
  const {t} = await laid({unit: '', from: 0, to: 100, events: [{at: 10, label: 'a'}, {at: 50, label: 'b'}, {at: 90, label: 'c'}]});
  assert.equal(new Set(t.stems.map(s => s.y1)).size, 1);
});

test('numeric timeline: seeded fuzz of events, lanes and spans is clean or refuses with a message', async () => {
  let seed = 20261127;
  const rnd = (): number => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  let drawn = 0, refused = 0;
  for (let i = 0; i < 60; i++) {
    const lanes = rnd() < 0.5 ? ['Lane one', 'Lane two'] : undefined, n = 2 + Math.floor(rnd() * 5);
    const events = Array.from({length: n}, () => ({at: 2008 + Math.round(rnd() * 190) / 10, label: 'Word '.repeat(1 + Math.floor(rnd() * 8)).trim(), ...(lanes ? {lane: lanes[Math.floor(rnd() * 2)]} : {})}));
    const spans = rnd() < 0.5 ? [{from: 2010 + Math.floor(rnd() * 5), to: 2018 + Math.floor(rnd() * 5), label: 'Span', ...(lanes ? {lane: lanes[Math.floor(rnd() * 2)]} : {})}] : [];
    try {
      const {t, verdict} = await laid({unit: '', from: 2008, to: 2027, step: 2, ...(lanes ? {lanes} : {}), events, spans}, [700, 900][i % 2]);
      clean(verdict);
      noClash(t);
      drawn++;
    } catch (e) {
      assert.match(String(e), /do not fit above the lane/);
      refused++;
    }
  }
  assert.ok(drawn >= 30, `drawn ${drawn}, refused ${refused}`);
});

test('date timeline: two wide marks at the axis end, a few days apart, also stagger', async () => {
  for (const gap of [1, 3, 5]) {
    const marks = [{at: '2026-05-31', label: 'Alpha'.repeat(5)}, {at: `2026-05-${31 - gap}`, label: 'Bravo'.repeat(5)}];
    const {t, verdict} = await laid({from: '2026-04-01', to: '2026-05-31', marks});
    clean(verdict);
    noClash(t);
  }
});

test('numeric timeline: the repro draws in a deck (renderDeck)', async () => {
  const fig = {version: 1, title: 't', parts: [{type: 'timeline', ...REPRO}]};
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-stagger-')), file = path.join(dir, 'deck.json');
  fs.writeFileSync(file, JSON.stringify({slides: [{title: 'S', figure: fig}]}));
  const r = loadDeck(file);
  assert.ok(r.ok, JSON.stringify(r));
  const out = await renderDeck(r.loaded, cfg);
  fs.rmSync(dir, {recursive: true, force: true});
  assert.deepEqual(out.errors, []);
  assert.ok(out.slides[0]);
});

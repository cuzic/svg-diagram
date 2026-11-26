// A date timeline without `now` and `deadline`: the axis comes from the items (marks) alone (ADR 0008 item 5, status note).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {loadDeck} from '../lib/deck-load.ts';
import {areas, box, checkDiagram, closeMeasurer, diagram, renderDiagram, timeline} from '../lib/dsl.ts';
import type {LaidOutTimeline} from '../lib/dsl.ts';
import {configureMeasure} from '../lib/measure.ts';
import {renderDeck} from '../lib/present/render-deck.ts';
import {installResolveHook} from '../lib/resolve-hook.ts';
import {specToDiagram, validateSpec} from '../lib/spec.ts';
import type {Diagram} from '../lib/types/index.ts';
import {fineTickSets} from '../lib/calendar-axis.ts';
import {TIMELINE_AXIS} from '../lib/parts.ts';
import {JA_FONTS} from './helpers/text-engine.ts';

installResolveHook();
const cfg = {measure: 'font', fonts: JA_FONTS} as const;
configureMeasure(cfg);
test.after(() => closeMeasurer());

const MARKS = [{at: '2026-11-27', label: '試作'}, {at: '2026-12-03', label: '確認'}, {at: '2026-12-20', label: '公開'}, {at: '2027-01-15', label: '見直し'}];
const tl = (laid: {laidOut: {type: string}[]}) => laid.laidOut.find((b): b is LaidOutTimeline => b.type === 'timeline')!;
const fig = (t: unknown) => diagram({theme: 'blue', title: 't', legend: false}).add(t as never);

test('without now and deadline the axis comes from the marks; no now / deadline marker, no span, no remaining label', async () => {
  const r = await checkDiagram(fig(timeline({marks: MARKS})));
  assert.ok(r.verdict.ok, r.verdict.problems.join('\n'));
  const t = tl(r.laidOut);
  assert.equal(t.stems.length, 4);
  assert.equal(t.dots.length, 4);
  assert.equal(t.span, undefined);
  assert.equal(t.bracket, undefined);
  assert.equal(t.fullLine, undefined);
  assert.ok(t.dots.every(d => d.tone === 'muted' && d.r === 8));
  assert.ok(!t.texts.some(x => x.text === '現在' || /あと|過ぎた|期限/.test(x.text)));
  // padded: the first and last marks are inside the axis, not on its ends
  const xs = t.stems.map(s => s.x);
  assert.ok(Math.min(...xs) > t.axis.x1 + 4 && Math.max(...xs) < t.axis.x2 - 4);
});

test('only now, or only a deadline: that flag is drawn, there is no span between them', async () => {
  const a = tl((await checkDiagram(fig(timeline({now: {at: '2026-11-26'}, marks: MARKS})))).laidOut);
  assert.equal(a.span, undefined);
  assert.ok(a.texts.some(x => x.text === '現在' && x.fill === 'accent'));
  const b = tl((await checkDiagram(fig(timeline({deadline: {at: '2027-01-15', label: '締め', line: 'full'}, marks: MARKS.slice(0, 2)})))).laidOut);
  assert.equal(b.span, undefined);
  assert.ok(b.fullLine);
  assert.ok(b.dots.some(d => d.tone === 'danger'));
});

test('from / to may be given on their own or left out; a lone mark and an empty timeline', async () => {
  const half = tl((await checkDiagram(fig(timeline({from: '2026-11', marks: MARKS})))).laidOut);
  assert.ok(half.stems.length === 4);
  const one = await checkDiagram(fig(timeline({marks: [{at: '2026-12-01', label: '単独'}]})));
  assert.ok(one.verdict.ok, one.verdict.problems.join('\n'));
  assert.throws(() => timeline({}), /at least one of now, deadline or marks|from and to/);
  assert.throws(() => timeline({from: '2026', to: '2027'} as never), /now|deadline|marks/);
  assert.throws(() => timeline({marks: MARKS, from: '2026-12-10'}), /outside the axis/);
});

test('the given-both form still requires the deadline label and keeps the remaining label', async () => {
  const t = tl((await checkDiagram(fig(timeline({from: '2026', to: '2029', now: {at: '2026-10'}, deadline: {at: '2028-03-31', label: '終了'}})))).laidOut);
  assert.ok(t.span && t.bracket);
  assert.ok(t.texts.some(x => /^あと/.test(x.text)));
  assert.throws(() => timeline({from: '2026', to: '2029', now: {at: '2026-10'}, deadline: {at: '2028-03-31', label: ' '}}), /deadline.label/);
});

test('spec: now / deadline / from / to are optional in the date form', async () => {
  const part = {type: 'timeline', marks: MARKS};
  assert.deepEqual(validateSpec({version: 1, title: 't', parts: [part]} as never), []);
  const bad = validateSpec({version: 1, title: 't', parts: [{type: 'timeline'}]} as never);
  assert.ok(bad.length > 0);
  const svg = async (d: Diagram) => (await renderDiagram(d, {name: 'x.svg', budget: 'cacheOnly'})).svg;
  assert.equal(await svg(specToDiagram({version: 1, title: 't', parts: [part]} as never)), await svg(diagram({theme: 'blue', title: 't'}).add(timeline({marks: MARKS}))));
});

test('the same drawing through renderDiagram is stable', async () => {
  const a = await renderDiagram(fig(timeline({marks: MARKS})), {name: 't', budget: 'cacheOnly'});
  const b = await renderDiagram(fig(timeline({marks: MARKS})), {name: 't', budget: 'cacheOnly'});
  assert.equal(a.svg, b.svg);
});

test('a deck slide with a timeline without now and deadline goes through renderDeck', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-nodl-'));
  try {
    fs.writeFileSync(path.join(dir, 'fig.ts'), `import {diagram, timeline} from 'svg-diagram';\nexport default () => diagram({theme: 'blue', title: '予定', legend: false}).add(timeline({marks: ${JSON.stringify(MARKS)}}));\n`);
    fs.writeFileSync(path.join(dir, 'deck.json'), JSON.stringify({slides: [{title: '予定', figure: 'fig.ts'}]}));
    const got = loadDeck(path.join(dir, 'deck.json'));
    assert.ok(got.ok, JSON.stringify(got));
    const r = await renderDeck(got.loaded, cfg);
    assert.deepEqual(r.errors, []);
    assert.match(r.slides[0]?.svg ?? '', /試作/);
    assert.match(r.slides[0]?.svg ?? '', /見直し/);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

test('relative points are already expressible in the number form (days from today, value written after the label)', async () => {
  const t = tl((await checkDiagram(fig(timeline({unit: '日', from: 0, to: 35, events: [{at: 1, label: '最初'}, {at: 7, label: '次'}, {at: 30, label: '最後'}]})))).laidOut);
  assert.ok(t.texts.some(x => x.text === '7日'));
});

test('M1: remaining / span without both now and deadline are rejected (DSL and spec), not silently dropped', () => {
  assert.throws(() => timeline({marks: MARKS, remaining: 'あと3日'}), /remaining needs both now and deadline/);
  assert.throws(() => timeline({marks: MARKS, span: 'fill'}), /span needs both now and deadline/);
  assert.throws(() => timeline({now: {at: '2026-11-26'}, marks: MARKS, remaining: 'x'}), /remaining needs both/);
  assert.doesNotThrow(() => timeline({marks: MARKS, remaining: false}));
  const paths = (p: object) => validateSpec({version: 1, title: 't', parts: [{type: 'timeline', ...p}]} as never).map(i => i.path);
  assert.deepEqual(paths({marks: MARKS, remaining: 'x'}), ['parts[0].remaining']);
  assert.deepEqual(paths({marks: MARKS, span: 'fill'}), ['parts[0].span']);
  assert.deepEqual(paths({marks: MARKS, remaining: false}), []);
});

test('m1: the spec message for an omitted axis end does not print undefined', () => {
  const m = (p: object) => validateSpec({version: 1, title: 't', parts: [{type: 'timeline', marks: MARKS, ...p}]} as never).map(i => i.message).join('\n');
  assert.doesNotMatch(m({from: '2026-12'}), /undefined/);
  assert.match(m({from: '2026-12'}), /the last date/);
  assert.doesNotMatch(m({to: '2026-11'}), /undefined/);
});

test('m2: short date axes get day-level ticks chosen by fit; 2 months and longer keep month ticks', async () => {
  const ticks = async (marks: {at: string; label: string}[]) => tl((await checkDiagram(fig(timeline({marks})))).laidOut).texts.filter(x => x.part === TIMELINE_AXIS).map(x => x.text);
  const month = /^\d{4}(\/\d+)?$/;
  const two = await ticks(MARKS.slice(0, 3)); // 11/24 - 12/23: a 2-day step (31 daily ticks would be too many)
  assert.ok(two.includes('11/27') && two.includes('11/29') && !two.includes('11/28'), two.join());
  const daily = await ticks([{at: '2026-11-27', label: '試作'}, {at: '2026-12-01', label: '確認'}]); // 4 days + padding: a tick a day
  assert.ok(daily.includes('11/30') && daily.includes('12/1') && daily.includes('11/28'), daily.join());
  const weekly = await ticks([{at: '2026-11-27', label: 'a'}, {at: '2027-01-12', label: 'b'}]); // 46 days: Mondays (or every other), year on the first tick of the new year
  assert.ok(weekly.every(t => !month.test(t)) && weekly.some(t => /^2027\/1\/\d+$/.test(t)), weekly.join());
  const long = await ticks([{at: '2026-01-10', label: 'a'}, {at: '2026-06-10', label: 'b'}]); // months, as before
  assert.ok(long.length > 0 && long.every(t => month.test(t)), long.join());
});

test('m2: the 2-month cutoff and the sets', () => {
  assert.ok(fineTickSets(0, 60).length > 0);
  assert.equal(fineTickSets(0, 61).length, 0);
  const s10 = fineTickSets(20000, 20010);
  assert.equal(s10[0]?.length, 11); // every day
  assert.ok(s10.every((set, i) => i === 0 || set.length < (s10[i - 1]?.length ?? 0)));
  assert.ok(fineTickSets(20000, 20013)[0]?.length === 14, 'a 13-day axis still has a daily set to pick'); 
  for (const set of fineTickSets(20000, 20050).slice(2)) assert.ok(set.every(t => ((t.day % 7) + 7) % 7 === 4)); // Mondays
});

test('M2: a short axis never fails check where it passed before: narrow figures pick a coarser step', async () => {
  const t = timeline({from: '2026-12-01', to: '2026-12-11', now: {at: '2026-12-02'}, deadline: {at: '2026-12-09', label: '締切'}});
  for (const [cols, width] of [['a b', 940], ['a b c', 940], ['a b c', 1280]] as const) {
    const ids = cols.split(' ');
    const d = diagram({theme: 'blue', title: 't', width, legend: false}).add(areas(cols, Object.fromEntries(ids.map((k, i) => [k, i === 0 ? timeline({from: '2026-12-01', to: '2026-12-11', now: {at: '2026-12-02'}, deadline: {at: '2026-12-09', label: '締切'}}) : box({title: 'x'})]))) as never);
    const r = await checkDiagram(d);
    assert.ok(r.verdict.ok, `${cols} @${width}: ${r.verdict.problems.join('\n')}`);
  }
  const narrow = await checkDiagram(diagram({theme: 'blue', title: 't', width: 400, legend: false}).add(timeline({marks: [{at: '2026-12-01', label: 'a'}, {at: '2026-12-09', label: 'b'}]}) as never));
  assert.ok(narrow.verdict.ok, narrow.verdict.problems.join('\n'));
  // m1 (round 3): the year-labelled last tick is clamped at the figure's edge; the fit test must see that shift
  const edge = await checkDiagram(diagram({theme: 'blue', title: 't', width: 400, legend: false}).add(timeline({from: '2026-12-21', to: '2027-01-02', now: {at: '2026-12-21'}, deadline: {at: '2026-12-27', label: '締切', line: 'full'}}) as never));
  assert.ok(edge.verdict.ok, edge.verdict.problems.join('\n'));
  assert.ok(t);
});

test('m2: a deck slide with a one-week timeline draws daily ticks through renderDeck', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-short-'));
  try {
    fs.writeFileSync(path.join(dir, 'fig.ts'), `import {diagram, timeline} from 'svg-diagram';\nexport default () => diagram({theme: 'blue', title: '直近', legend: false}).add(timeline({marks: [{at: '2026-11-27', label: '明日'}, {at: '2026-12-01', label: '来週'}]}));\n`);
    fs.writeFileSync(path.join(dir, 'deck.json'), JSON.stringify({slides: [{title: '直近', figure: 'fig.ts'}]}));
    const got = loadDeck(path.join(dir, 'deck.json'));
    assert.ok(got.ok, JSON.stringify(got));
    const r = await renderDeck(got.loaded, cfg);
    assert.deepEqual(r.errors, []);
    const svg = r.slides[0]?.svg ?? '';
    assert.ok((svg.match(/V84"/g) ?? []).length >= 9, 'a tick a day over the ten-day axis (text is glyph paths in a deck)');
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

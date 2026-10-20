import test from 'node:test';
import assert from 'node:assert/strict';
import {box, caption, checkDiagram, closeMeasurer, connect, diagram, renderDiagram, timeline} from '../lib/dsl.ts';
import {remainingText} from '../lib/timeline.ts';
import type {LaidOutTimeline} from '../lib/dsl.ts';

test.after(() => closeMeasurer());

const BASE = {from: '2026', to: '2029', now: {at: '2026-10', label: '今'}, deadline: {at: '2028-03-31', label: 'サポート終了'}};
const laid = async (opts: Parameters<typeof timeline>[0], extra: {title?: string; sourceLine?: string} = {}) => {
  const d = diagram({theme: 'blue', title: 't', ...extra}).add(timeline(opts));
  const r = await checkDiagram(d);
  return {t: r.laidOut.laidOut.find((x): x is LaidOutTimeline => x.type === 'timeline')!, verdict: r.verdict, laidOut: r.laidOut};
};

test('remainingText: calendar months, years, days, and past the deadline', () => {
  assert.equal(remainingText('2026-10', '2028-03-31'), 'あと 1 年 5 か月');
  assert.equal(remainingText('2026-10', '2027-10'), 'あと 1 年');
  assert.equal(remainingText('2026-10', '2027-03'), 'あと 5 か月');
  assert.equal(remainingText('2026-10-01', '2026-10-20'), 'あと 19 日');
  assert.equal(remainingText('2026-10-15', '2026-10-15'), '期限は今日');
  assert.equal(remainingText('2028-05', '2028-03'), '期限を 2 か月 過ぎた');
});

test('timeline: now, marks and the deadline sit in date order on the axis, the span runs between now and the deadline', async () => {
  const {t, verdict} = await laid({...BASE, marks: [{at: '2027-04', label: '予算申請'}]});
  assert.ok(verdict.ok, verdict.problems.join('\n'));
  const xs = t.dots.map(d => d.x); // now, deadline, mark
  assert.ok(xs[0]! < xs[2]! && xs[2]! < xs[1]!);
  assert.equal(t.span!.x1, xs[0]);
  assert.equal(t.span!.x2, xs[1]);
  assert.equal(t.span!.tone, 'accent');
  assert.ok(t.texts.some(x => x.text === 'あと 1 年 5 か月'));
  assert.ok(t.texts.some(x => x.text === 'サポート終了' && x.fill === 'danger'));
});

test('timeline: a deadline already past draws the span in danger', async () => {
  const {t} = await laid({...BASE, now: {at: '2028-09'}});
  assert.equal(t.span!.tone, 'danger');
  assert.ok(t.texts.some(x => x.text === '期限を 5 か月 過ぎた'));
  assert.ok(t.texts.some(x => x.text === '現在'));
});

test('timeline: remaining overrides the label, false drops it', async () => {
  assert.ok((await laid({...BASE, remaining: '残り 1.5 年'})).t.texts.some(x => x.text === '残り 1.5 年'));
  const none = (await laid({...BASE, remaining: false})).t;
  assert.equal(none.bracket, undefined);
  assert.ok(none.span);
  assert.ok(!none.texts.some(x => x.text.startsWith('あと')));
});

test('timeline: crowded labels go to higher levels instead of overlapping; verify finds nothing', async () => {
  const marks = [{at: '2026-11', label: '調査'}, {at: '2026-12', label: '見積もり'}, {at: '2027-01', label: '稟議'}];
  const {t, verdict} = await laid({...BASE, marks});
  assert.ok(verdict.ok, verdict.problems.join('\n'));
  assert.ok(new Set(t.stems.map(s => s.y1)).size >= 3, 'stems start at different heights');
  for (const [i, a] of t.labelBoxes.entries()) for (const b of t.labelBoxes.slice(i + 1)) assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${a.label} / ${b.label}`);
});

test('timeline: labels that cannot be separated throw', async () => {
  const marks = Array.from({length: 8}, (_, i) => ({at: `2026-11-0${i + 1}`, label: `ずっと長い名前のマーク${i}`}));
  await assert.rejects(laid({from: '2026-10', to: '2026-12', now: {at: '2026-10'}, deadline: {at: '2026-12', label: '期限'}, marks}), /do not fit/);
});

test('timeline: bad input throws, naming the field', () => {
  assert.throws(() => timeline({...BASE, from: '2026/01'}), /from must be 'YYYY'/);
  assert.throws(() => timeline({...BASE, from: '2026-02-30'}), /not a real date/);
  assert.throws(() => timeline({...BASE, from: '2029', to: '2026'}), /must be before/);
  assert.throws(() => timeline({...BASE, deadline: {at: '2031', label: 'x'}}), /deadline.at \(2031\) is outside the axis/);
  assert.throws(() => timeline({...BASE, now: {at: '2025'}}), /now.at \(2025\) is outside/);
  assert.throws(() => timeline({...BASE, marks: [{at: '2040', label: 'x'}]}), /marks\[0\].at/);
  assert.throws(() => timeline({...BASE, deadline: {at: '2028', label: ' '}}), /deadline.label is required/);
  assert.throws(() => timeline({...BASE, marks: [{at: '2027', label: 'x', tone: 'blue' as never}]}), /tone must be/);
  assert.throws(() => timeline({...BASE, now: undefined as never}), /now is required/);
  assert.throws(() => timeline({...BASE, reveal: 1, remaining: 3 as never}), /remaining must be/);
});

test('timeline: the same source draws the same bytes (no clock), an id is a connect() endpoint, reveal hides the whole band', async () => {
  const draw = async (extra = {}) => (await renderDiagram(diagram({theme: 'blue', title: 't'}).add(box({title: 'x', id: 'x'}), timeline({...BASE, id: 'tl', ...extra}), connect('x:bottom', 'tl:top')), {name: 't', budget: 'measure'})).svg;
  assert.equal(await draw(), await draw());
  const svg = await draw();
  assert.ok(svg.includes('サポート終了') && svg.includes('stroke-width="8"'));
});

test('diagram({sourceLine}): always the last line, left-aligned, whatever the add() order', async () => {
  const d = diagram({theme: 'blue', title: 't', sourceLine: '出典: 総務省 2025'}).add(caption('見出し'), box({title: '本文', id: 'a'}));
  const {laidOut, verdict} = await checkDiagram(d);
  assert.ok(verdict.ok, verdict.problems.join('\n'));
  const last = laidOut.laidOut.at(-1)!;
  assert.equal(last.type, 'caption');
  assert.equal((last as {text: string}).text, '出典: 総務省 2025');
  assert.equal(last.x, d.pad);
  assert.equal((last as {align: string}).align, 'left');
  assert.ok(laidOut.laidOut.slice(0, -1).every(b => b.y + ('h' in b ? b.h : 0) <= last.y), 'no band reaches the source line');
  assert.equal(laidOut.canvasHeight, Math.round(last.y + (last as {h: number}).h + d.pad));
  const noSource = await checkDiagram(diagram({theme: 'blue', title: 't'}).add(caption('見出し'), box({title: '本文', id: 'a'})));
  assert.equal(noSource.laidOut.laidOut.length, laidOut.laidOut.length - 1);
  assert.ok(!d.bands.some(b => b.type === 'caption' && (b as {text: string}).text.startsWith('出典')), 'the input diagram is not changed');
});

test('diagram({sourceLine}): the text shows up in the SVG; a line that wraps warns (source-wraps)', async () => {
  const r = await renderDiagram(diagram({theme: 'blue', title: 't', sourceLine: '出典: 総務省 2025'}).add(box({title: '本文'})), {name: 't', budget: 'measure'});
  assert.ok(r.svg.includes('出典: 総務省 2025'));
  assert.ok(!r.verdict.findings.some(f => f.rule === 'source-wraps'));
  const long = await checkDiagram(diagram({theme: 'blue', title: 't', sourceLine: '出典: ' + 'とても長い出典の名前'.repeat(10)}).add(box({title: '本文'})));
  assert.ok(long.verdict.findings.some(f => f.rule === 'source-wraps' && f.severity === 'warn'));
});

test('diagram({sourceLine}): empty or multi-line text throws', () => {
  assert.throws(() => diagram({theme: 'blue', sourceLine: ' '}), /sourceLine/);
  assert.throws(() => diagram({theme: 'blue', sourceLine: 'a\nb'}), /single-line/);
});

test('timeline and sourceLine coexist: the source line sits under the timeline', async () => {
  const {t, laidOut} = await laid(BASE, {sourceLine: '出典: ベンダー告知'});
  assert.ok(laidOut.laidOut.at(-1)!.y >= t.y + t.h);
});

test("timeline: deadline.line 'full' draws a line through the whole figure, clear of every label", async () => {
  const marks = [{at: '2026-12', label: '予算申請'}, {at: '2027-01', label: '調査'}];
  const {t, verdict} = await laid({...BASE, deadline: {...BASE.deadline, line: 'full'}, marks});
  assert.ok(verdict.ok, verdict.problems.join('\n'));
  assert.deepEqual([t.fullLine!.x, t.fullLine!.y1, t.fullLine!.y2], [t.dots[1]!.x, t.y, t.y + t.h]);
  for (const b of t.labelBoxes) assert.ok(b.x + b.w <= t.fullLine!.x - 1 || b.x >= t.fullLine!.x + 1, b.label);
  assert.equal((await laid(BASE)).t.fullLine, undefined);
});

test("timeline: span 'fill' paints a band instead of the bar; bad span / line throw", async () => {
  const svg = async (span?: 'bar' | 'fill') => (await renderDiagram(diagram({theme: 'blue', title: 't'}).add(timeline({...BASE, ...(span ? {span} : {})})), {name: 't', budget: 'measure'})).svg;
  assert.equal(await svg('bar'), await svg(), 'bar is the default');
  const fill = await svg('fill');
  assert.ok(fill.includes('height="24" fill="#dce9f7"') && !fill.includes('stroke-width="8"'));
  assert.throws(() => timeline({...BASE, span: 'x' as never}), /span must be/);
  assert.throws(() => timeline({...BASE, deadline: {...BASE.deadline, line: 'half' as never}}), /deadline.line must be/);
});

test("timeline: deadline.line 'full' over a tick label (2026-10 to 2027-06, deadline 2027-02-28, one mark) builds; the label steps aside", async () => {
  const opts = {from: '2026-10', to: '2027-06', now: {at: '2026-10-12'}, deadline: {at: '2027-02-28', label: 'Extended Support 終了', line: 'full' as const}, marks: [{at: '2027-01', label: '移行リハーサル'}]};
  for (const span of [undefined, 'fill' as const]) {
    const {t, verdict} = await laid({...opts, ...(span ? {span} : {})});
    assert.ok(verdict.ok, verdict.problems.join('\n'));
    const x = t.fullLine!.x, [from, to] = [Date.UTC(2026, 9, 1), Date.UTC(2027, 5, 1)];
    const at = (iso: string) => t.axis.x1 + (Date.parse(iso) - from) / (to - from) * (t.axis.x2 - t.axis.x1);
    assert.ok(Math.abs(x - at('2027-02-28')) < 0.01, 'the deadline is placed by day');
    const tick = t.ticks.find(k => Math.abs(k.x - at('2027-03-01')) < 0.01)!;
    assert.ok(tick.x > x && tick.x - x < 6, 'the March tick is a day after the line');
    const label = t.texts.find(l => l.text === '2027/3');
    assert.ok(label && label.x > x, 'the label moved to the right of the line');
    for (const b of t.labelBoxes) assert.ok(b.x + b.w <= x - 1 || b.x >= x + 1, b.label);
  }
});

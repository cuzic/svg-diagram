import test from 'node:test';
import './helpers/strict-width.ts'; // a label the layout did not register for measuring throws instead of measuring 0 wide
import assert from 'node:assert/strict';
import {box, checkDiagram, closeMeasurer, connect, diagram, gantt, renderDiagram} from '../lib/dsl.ts';
import type {LaidOutGantt} from '../lib/types.ts';

test.after(() => closeMeasurer());

const plan = () => gantt([
  {section: '設計'},
  {id: 'req', label: '要件', start: '2026-10-05', end: '2026-10-16', progress: 1},
  {id: 'ui', label: '画面', start: '2026-10-12', days: 10, progress: 0.5, after: 'req'},
  {label: '実装', start: '2026-10-26', end: '2026-11-20', after: ['req', 'ui'], tone: 'danger'},
  {label: 'リリース', start: '2026-11-27', milestone: true},
], {today: '2026-10-19'});

const laid = async (...bands: unknown[]) => {
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue'}).add(...(bands as never[])));
  return {t: laidOut.laidOut.find(b => b.type === 'gantt') as LaidOutGantt, verdict};
};

test('gantt() places bars by date, rows in order, and passes verify', async () => {
  const {t, verdict} = await laid(plan());
  assert.deepEqual(verdict.problems, []);
  assert.equal(t.bars.length, 4);
  const [req, ui, impl, ms] = t.bars;
  assert.ok(ui.x > req.x && ui.x < req.x + req.w, 'the 10/12 start is inside the 10/5 - 10/16 bar');
  assert.ok(Math.abs(req.w / 12 - ui.w / 10) < 0.5, 'one day is one width');
  assert.ok(req.y < ui.y && ui.y < impl.y && impl.y < ms.y);
  assert.equal(ms.milestone, true);
  assert.equal(ui.progress, 0.5);
  assert.equal(impl.tone, 'danger');
  assert.equal(t.deps.length, 3);
  assert.ok(t.today && t.today.x > req.x && t.today.x < impl.x);
  assert.equal(t.sections.length, 1);
});

test('gantt() tasks with an id are anchors for connect()', async () => {
  const g = plan();
  assert.equal(g.anchors.req.id, 'req');
  const {verdict} = await checkDiagram(diagram({theme: 'blue'}).add(g, box({id: 'memo', title: '承認'}), connect('ui', 'memo', {route: 'elbow'})));
  assert.deepEqual(verdict.problems, []);
});

test('gantt() draws bars, progress, diamond, today and dependency heads in the SVG', async () => {
  const {svg} = await renderDiagram(diagram({theme: 'blue'}).add(plan()), {name: 'g.svg', budget: 'cacheOnly'});
  assert.match(svg, />今日</);
  assert.equal(svg.match(/<rect [^>]*rx="4"/g)?.length, 5); // 3 plain bars + 1 bar with progress 0.5 (outline + done part) ... the milestone is a path
  const t = (await checkDiagram(diagram({theme: 'blue'}).add(plan()))).laidOut.laidOut.find(b => b.type === 'gantt') as LaidOutGantt;
  const ui = t.bars[1], widths = [...svg.matchAll(/<rect [^>]*width="([\d.]+)"[^>]*rx="4" fill="#1d5fa8"\/>/g)].map(m => +m[1]);
  assert.ok(widths.some(w => Math.abs(w - ui.w * 0.5) <= 4), `the done part is half of the bar, to the pixel grid (${ui.w}): ${widths}`);
  assert.match(svg, /M[\d.]+,[\d.]+ L[\d.]+,[\d.]+ L[\d.]+,[\d.]+ L[\d.]+,[\d.]+ z/); // the diamond
});

test('gantt() rejects bad input', async () => {
  const bad = (rows: object[], opts: object = {}) => checkDiagram(diagram({theme: 'blue'}).add(gantt(rows as never, opts as never)));
  assert.throws(() => gantt([]), /at least one task/);
  assert.throws(() => gantt([{section: 'x'}]), /at least one task/);
  assert.throws(() => gantt([{label: 'a', start: '2026-10-01', end: '2026-10-02', tone: 'x' as never}]), /tone must be/);
  await assert.rejects(() => bad([{label: 'a', start: '2026-10-05', end: '2026-10-01'}]), /before it starts/);
  await assert.rejects(() => bad([{label: 'a', start: '2026-10-05'}]), /needs end or days/);
  await assert.rejects(() => bad([{label: 'a', start: '2026-10-05', end: '2026-10-06', days: 2}]), /both end and days/);
  await assert.rejects(() => bad([{label: 'a', start: '10/5', days: 2}]), /must be 'YYYY-MM-DD'/);
  await assert.rejects(() => bad([{label: 'a', start: '2026-10-05', days: 2, after: 'zz'}]), /unknown task id "zz"/);
  await assert.rejects(() => bad([{id: 'q', label: 'a', start: '2026-10-05', days: 2}, {id: 'q', label: 'b', start: '2026-10-05', days: 2}]), /duplicate task id "q"/);
  await assert.rejects(() => bad([{label: 'a', start: '2026-10-05', days: 2, progress: 2}]), /progress must be/);
  await assert.rejects(() => bad([{label: 'a', start: '2026-10-05', days: 2}], {today: '2027-01-01'}), /today .* is outside the axis/);
  await assert.rejects(() => bad([{label: 'a', start: '2026-10-05', days: 2}], {from: '2026-10-06'}), /outside the axis/);
});

test('gantt() on a long axis ticks by month', async () => {
  const {t, verdict} = await laid(gantt([{label: '長期', start: '2026-01-01', end: '2026-12-31'}]));
  assert.deepEqual(verdict.problems, []);
  assert.ok(t.texts.some(x => /^2026\/\d+$/.test(x.text) || x.text === '2026'));
});

test('gantt(): the weekly ticks and every other label are registered for measuring (strict width) and fit the figure', async () => {
  for (const g of [gantt([{label: 'A', start: '2026-01-05', days: 133}], {}), gantt([{label: 'A', start: '2026-01-01', end: '2026-12-31'}])]) {
    const {t, verdict} = await laid(g);
    assert.deepEqual(verdict.problems, []);
    assert.ok(t.labelBoxes.every(b => b.w > 0), 'no label is measured as 0 wide');
  }
  const narrow = await checkDiagram(diagram({theme: 'blue', width: 520}).add(gantt([{label: 'A', start: '2026-01-05', days: 133}])));
  const ticks = (narrow.laidOut.laidOut.find(b => b.type === 'gantt') as LaidOutGantt).texts.filter(x => /^\d+\/\d+$/.test(x.text));
  for (let i = 1; i < ticks.length; i++) assert.ok(ticks[i].x - ticks[i - 1].x >= 30, 'ticks of a narrow figure do not pile up');
});

test('gantt(): today on the last day keeps its label inside; a short axis with no Monday still has a date; the last milestone stays inside', async () => {
  const {t, verdict} = await laid(gantt([{label: 'A', start: '2026-12-01', end: '2026-12-31'}, {label: 'M', start: '2026-12-31', milestone: true}], {today: '2026-12-31', todayLabel: '本日'}));
  assert.deepEqual(verdict.problems, []);
  assert.ok(t.bars[1].x + t.bars[1].w <= t.plot.x2 + 12 && t.bars[1].x + t.bars[1].w <= t.x + t.w);
  const short = (await laid(gantt([{label: 'A', start: '2026-10-13', end: '2026-10-16'}]))).t;
  assert.ok(short.texts.some(x => /^\d+\/\d+$/.test(x.text)), 'a date on the axis');
});

test('gantt(): a dependency arrow keeps out of the bars of the rows between: straight on, or along the line between rows', async () => {
  const cases: [string, object[], object?][] = [
    ['forward, a free column', [{id: 'a', label: 'A', start: '2026-10-05', end: '2026-10-09'}, {label: 'X', start: '2026-10-12', end: '2026-10-30'}, {label: 'B', start: '2026-10-12', end: '2026-10-16', after: 'a'}]],
    ['forward, no free column before the head (the line between rows, a free column outside the bar)', [{id: 'a', label: 'A', start: '2026-10-05', end: '2026-10-09'}, {label: 'X', start: '2026-10-05', end: '2026-10-30'}, {label: 'B', start: '2026-10-12', end: '2026-10-16', after: 'a'}], {from: '2026-10-01', to: '2026-11-10'}],
    ['backward (the head starts before the tail ends)', [{id: 'a', label: 'A', start: '2026-10-01', end: '2026-10-20'}, {label: 'X', start: '2026-10-05', end: '2026-10-30'}, {label: 'B', start: '2026-10-05', days: 3, after: 'a'}], {from: '2026-10-01', to: '2026-11-10'}],
    ['upward (a task listed first comes after a later one)', [{label: 'B', start: '2026-10-12', end: '2026-10-16', after: 'a'}, {label: 'X', start: '2026-10-05', end: '2026-10-30'}, {id: 'a', label: 'A', start: '2026-10-05', end: '2026-10-09'}], {from: '2026-10-01', to: '2026-11-10'}],
  ];
  for (const [name, rows, opts] of cases) {
    const {t, verdict} = await laid(gantt(rows as never, opts as never));
    assert.deepEqual(verdict.problems, [], name);
    assert.equal(t.deps.length, 1, name);
  }
  // only when the rows between fill the whole axis is there nowhere to go: verify says which bar
  const full = await laid(gantt([
    {id: 'a', label: 'A', start: '2026-10-05', end: '2026-10-09'}, {label: 'X', start: '2026-10-05', end: '2026-10-30'}, {label: 'Y', start: '2026-10-05', end: '2026-10-30'},
    {label: 'B', start: '2026-10-12', end: '2026-10-16', after: 'a'},
  ], {from: '2026-10-05', to: '2026-10-30'}));
  assert.ok(full.verdict.problems.some(p => /"A" -> "B" runs through the bar "[XY]"/.test(p)), JSON.stringify(full.verdict.problems));
});

test('gantt() rejects loose dates, milestone with a length, and an after that loops', async () => {
  const bad = (rows: object[]) => checkDiagram(diagram({theme: 'blue'}).add(gantt(rows as never)));
  await assert.rejects(() => bad([{label: 'a', start: '2026-10', days: 2}]), /must be 'YYYY-MM-DD'/);
  await assert.rejects(() => bad([{label: 'a', start: '2026-10-05', milestone: true, days: 2}]), /milestone .* drop end \/ days/);
  await assert.rejects(() => bad([{id: 'a', label: 'a', start: '2026-10-05', days: 2, after: 'a'}]), /after itself/);
  await assert.rejects(() => bad([{id: 'a', label: 'a', start: '2026-10-05', days: 2, after: 'b'}, {id: 'b', label: 'b', start: '2026-10-08', days: 2, after: 'a'}]), /cycle/);
});

test('gantt(): task ids come with the figure (reveal); a task id cannot be spotlighted', async () => {
  const g = gantt([{id: 'a', label: 'A', start: '2026-10-05', days: 3}], {reveal: 2});
  const {laidOut} = await checkDiagram(diagram({theme: 'blue'}).add(g, box({id: 'ext', title: '外部', reveal: 2}), connect('a', 'ext', {route: 'elbow'})));
  assert.equal(laidOut.connects[0].reveal, 2);
  await assert.rejects(() => checkDiagram(diagram({theme: 'blue', spotlight: 'a'}).add(gantt([{id: 'a', label: 'A', start: '2026-10-05', days: 3}]))), /node inside a figure/);
});

test('gantt(): a connector that ends on the whole figure (its id) is not stopped by its tasks', async () => {
  const g = gantt([{id: 'a', label: 'A', start: '2026-10-05', days: 5}, {id: 'b', label: 'B', start: '2026-10-05', days: 5}], {id: 'G'});
  const {verdict} = await checkDiagram(diagram({theme: 'blue'}).add(g, box({id: 'ext', title: '外部'}), connect('G', 'ext', {route: 'elbow'})));
  assert.deepEqual(verdict.problems, []);
});

test('gantt(): even when nothing is free, the arrow still ends on the head bar (verify is what stops it)', async () => {
  const {laidOut, verdict} = await checkDiagram(diagram({theme: 'blue'}).add(gantt([
    {id: 'a', label: 'A', start: '2026-10-05', end: '2026-10-09'}, {label: 'X', start: '2026-10-05', end: '2026-10-30'}, {label: 'Y', start: '2026-10-05', end: '2026-10-30'},
    {label: 'B', start: '2026-10-12', end: '2026-10-16', after: 'a'},
  ], {from: '2026-10-05', to: '2026-10-30'})));
  const t = laidOut.laidOut.find(b => b.type === 'gantt') as LaidOutGantt;
  assert.ok(verdict.problems.some(p => /runs through the bar/.test(p)));
  const end = t.deps[0].points[t.deps[0].points.length - 1], head = t.bars[3];
  assert.ok(Math.abs(end.x - head.x) < 0.5 && end.y >= head.y && end.y <= head.y + head.h, 'the arrow ends on the left edge of B');
});

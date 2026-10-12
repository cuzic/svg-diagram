import test from 'node:test';
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
  const {verdict} = await checkDiagram(diagram({theme: 'blue'}).add(g, box({id: 'memo', title: '承認'}), connect('req', 'memo', {route: 'elbow'})));
  assert.deepEqual(verdict.problems.filter(p => !p.includes('crosses')), []);
});

test('gantt() draws bars, progress, diamond, today and dependency heads in the SVG', async () => {
  const {svg} = await renderDiagram(diagram({theme: 'blue'}).add(plan()), {name: 'g.svg', budget: 'cacheOnly'});
  assert.match(svg, />今日</);
  assert.ok((svg.match(/rx="4"/g)?.length ?? 0) >= 5); // 3 bars, 2 of them with a progress part... plus the done parts
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

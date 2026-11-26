// B2: reference lines (`lines`) on horizontal bars are vertical lines at a value; their labels stand above the bars.
import test from 'node:test';
import assert from 'node:assert/strict';
import {bars, checkDiagram, closeMeasurer, diagram, renderDiagram} from '../lib/dsl.ts';
import {specToDiagram} from '../lib/spec.ts';
import type {LaidOutBars} from '../lib/dsl.ts';

test.after(() => closeMeasurer());

const DATA = [{label: 'Alpha line', value: 80}, {label: 'Beta line', value: 55}, {label: 'Gamma line', value: 30}, {label: 'Delta line', value: 62}];
const laid = async (opts: Parameters<typeof bars>[1]) => {
  const r = await checkDiagram(diagram({theme: 'blue', title: 't'}).add(bars(DATA, {unit: '件', ...opts})));
  return {b: r.laidOut.laidOut.find((x): x is LaidOutBars => x.type === 'bars')!, verdict: r.verdict};
};

test('lines on horizontal bars: vertical lines at the value, from above the bars to the axis, no problems', async () => {
  const {b, verdict} = await laid({max: 100, lines: [{at: 60, label: 'Target'}]});
  assert.deepEqual(verdict.problems, []);
  const l = b.ink!.lines.find(x => !x.soft)!;
  assert.equal(l.x1, l.x2, 'vertical');
  assert.ok(l.y2 > l.y1);
  const top = Math.min(...b.bars.map(r => r.y));
  assert.ok(l.y1 < top, 'starts above the first bar');
  const tick60 = b.texts.find(t => t.text === '60')!;
  assert.ok(Math.abs(tick60.x - l.x1) < 1, 'at the 60 of the value axis');
  const label = b.labelBoxes.find(x => x.label === 'Target')!;
  assert.ok(label.y + label.h <= top, 'the label is above the bars');
});

test('a line that crosses a value label moves the label off the line', async () => {
  // Beta (55) ends near the line at 60: the value text would sit across it
  const {b, verdict} = await laid({max: 100, lines: [{at: 58}, {at: 82, label: 'Limit', tone: 'muted'}]});
  assert.deepEqual(verdict.problems, []);
  assert.equal(b.ink!.lines.length, 2);
});

test('close line labels clear each other (side by side or on separate rows); a label at the end of the axis stays inside the figure', async () => {
  const {b, verdict} = await laid({max: 100, lines: [{at: 50, label: 'First target'}, {at: 52, label: 'Second target'}, {at: 100, label: 'End of scale'}]});
  assert.deepEqual(verdict.problems, []);
  for (const x of b.labelBoxes) assert.ok(x.x >= b.x - 0.5 && x.x + x.w <= b.x + b.w + 0.5, x.label);
});

test('lines still need unstacked bars', () => {
  assert.throws(() => bars(DATA, {stack: true, lines: [{at: 10}]}), /lines/);
});

test('spec: bars with lines and the default or explicit dir h are accepted and draw', async () => {
  for (const dir of [undefined, 'h']) {
    const part = {type: 'bars', ...(dir ? {dir} : {}), unit: '件', data: DATA, lines: [{at: 60, label: 'Target'}]};
    const r = await checkDiagram(specToDiagram({version: 1, title: 't', parts: [part]}));
    assert.deepEqual(r.verdict.problems, []);
    const svg = (await renderDiagram(specToDiagram({version: 1, title: 't', parts: [part]}), {name: 't', budget: 'measure'})).svg;
    assert.match(svg, /Target/);
  }
});

// M2 / m2: a label on a higher row is reached by a leader; no leader may cross a label
const crosses = (b: LaidOutBars): string[] => b.ink!.lines.filter(l => l.soft).flatMap(l => b.labelBoxes.filter(x => l.x1 > x.x && l.x1 < x.x + x.w && x.y < l.y2 && x.y + x.h > l.y1).map(x => x.label));

const CLOSE = [{at: 50, label: 'First target long label'}, {at: 51, label: 'Second one here'}, {at: 52, label: 'C'}, {at: 53, label: 'Fourth label'}];
const raised = (b: LaidOutBars, labels: string[]): number => { const ys = b.labelBoxes.filter(x => labels.includes(x.label)).map(x => x.y), low = Math.max(...ys); return ys.filter(y => y < low).length; };

test('every label above row 0 has a leader down to its line, and no leader crosses a label (horizontal bars)', async () => {
  for (const lines of [CLOSE.slice(0, 2), CLOSE.slice(0, 3), CLOSE]) {
    const {b, verdict} = await laid({max: 100, lines});
    assert.deepEqual(verdict.problems, []);
    assert.deepEqual(crosses(b), []);
    assert.equal(b.ink!.lines.filter(l => l.soft).length, raised(b, lines.map(l => l.label)));
  }
  const {b} = await laid({max: 100, lines: CLOSE});
  assert.ok(raised(b, CLOSE.map(l => l.label)) >= 1, 'four close labels need more than one row');
});

test('the same holds for the labels of vlines on vertical bars', async () => {
  const vl = CLOSE.map((l, k) => ({at: 1 + k * 0.05, label: l.label}));
  const r = await checkDiagram(diagram({theme: 'blue', title: 't'}).add(bars(DATA, {dir: 'v', max: 100, vlines: vl})));
  const b = r.laidOut.laidOut.find((x): x is LaidOutBars => x.type === 'bars')!;
  assert.deepEqual(r.verdict.problems, []);
  assert.deepEqual(crosses(b), []);
  assert.equal(b.ink!.lines.filter(l => l.soft).length, raised(b, vl.map(l => l.label)));
  assert.ok(raised(b, vl.map(l => l.label)) >= 1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {banner, bars, box, caption, checkDiagram, closeMeasurer, diagram, fillScaleLimit, group, plane, table} from '../lib/dsl.ts';
import {layoutBars, barsTexts} from '../lib/bars.ts';
import {layoutPlane, planeTexts} from '../lib/plane.ts';
import {analyzeFit} from '../lib/fit.ts';
import {ROLES} from '../lib/tokens.ts';
import type {LaidOutBanner, LaidOutPlane, Role} from '../lib/dsl.ts';

// every atom must be registered for measuring, or layout throws instead of measuring 0 wide
process.env['SVG_DIAGRAM_STRICT_WIDTH'] = '1';
test.after(() => closeMeasurer());

test('hero is gone from Role and ROLES', () => {
  assert.ok(!('hero' in ROLES));
  // @ts-expect-error hero was removed
  const r: Role = 'hero';
  assert.equal(r, 'hero');
});

test('box({size}) is reported by the box-size-ignored rule once per figure (no console output); the px check stays', async () => {
  const warned: string[] = [];
  const orig = console.warn;
  console.warn = (...a: unknown[]) => { warned.push(a.join(' ')); };
  let findings;
  try {
    findings = (await checkDiagram(diagram({theme: 'blue'}).add(box({title: 'x', size: 20}), box({title: 'y', size: 30}), box({title: 'z'})))).verdict.findings.filter(f => f.rule === 'box-size-ignored');
  } finally { console.warn = orig; }
  assert.deepEqual(warned, [], 'no process-wide warning any more');
  assert.equal(findings.length, 1, 'one finding for the figure');
  assert.equal(findings[0].severity, 'warn');
  assert.match(findings[0].message, /2 個の箱/);
  assert.deepEqual((await checkDiagram(diagram({theme: 'blue'}).add(box({title: 'z'})))).verdict.findings.filter(f => f.rule === 'box-size-ignored'), []);
  assert.throws(() => box({title: 'x', size: 10 as 14}), /below the 14px floor/);
});

test('banner({headlineRole}) sets the headline size and grows the banner', async () => {
  const sizeOf = async (role?: 'banner' | 'stat' | 'display') => {
    const {laidOut} = await checkDiagram(diagram({theme: 'blue'}).add(banner({headline: '見出し', ...(role ? {headlineRole: role} : {})})));
    const b = laidOut.laidOut[0] as LaidOutBanner;
    return {size: b.wrappedRuns[0]!.size, h: b.h};
  };
  const base = await sizeOf(), stat = await sizeOf('stat'), display = await sizeOf('display');
  assert.equal(base.size, ROLES.banner);
  assert.equal(stat.size, ROLES.stat);
  assert.equal(display.size, ROLES.display);
  assert.ok(base.h < stat.h && stat.h < display.h);
  assert.throws(() => banner({headline: 'x', headlineRole: 'note' as 'banner'}), /headlineRole must be/);
});

test('bars / plane labelRole: measured, laid out and drawn at one size', async () => {
  const b = bars([{label: 'A', value: 3}, {label: 'B', value: 5}], {max: 6, labelRole: 'stat'});
  assert.ok(barsTexts(b, ROLES).every(([, size]) => size === ROLES.stat));
  const widthOf = (_a: string, size: number) => size * 0.5;
  const laid = layoutBars(b, 0, 0, 800, widthOf, ROLES);
  assert.ok(laid.texts.every(t => t.size === ROLES.stat));
  assert.ok(laid.bars.every(r => r.h >= ROLES.stat + 14), 'bars are as thick as their labels');
  const plain = layoutBars(bars([{label: 'A', value: 3}], {max: 6}), 0, 0, 800, widthOf, ROLES);
  assert.ok(plain.texts.every(t => t.size === ROLES.note) && plain.bars[0]!.h === 28);

  const p = plane({labelRole: 'banner', x: {label: 'X', max: 10}, y: {label: 'Y', max: 10}, height: 400, points: [{id: 'p', at: [5, 5], label: 'Point'}]});
  assert.ok(planeTexts(p, ROLES).every(([, size]) => size === ROLES.banner));
  const lp: LaidOutPlane = layoutPlane(p, 0, 0, 800, widthOf, ROLES);
  assert.equal(lp.labelSize, ROLES.banner);
  const label = lp.labelBoxes.find(x => x.label === 'Point')!;
  assert.equal(label.w, ROLES.banner * 0.5, 'measured at the role size');
  assert.equal(label.h, ROLES.banner + 6);
  assert.throws(() => bars([{label: 'A', value: 1}], {labelRole: 'display' as 'note'}), /labelRole must be/);
  assert.throws(() => plane({labelRole: 'title' as 'note', x: {max: 1}, y: {max: 1}}), /labelRole must be/);
});

test('every label of a labelRole figure is registered for measuring (STRICT_WIDTH: no miss)', async () => {
  assert.ok(process.env['SVG_DIAGRAM_STRICT_WIDTH']);
  const d = diagram({theme: 'blue', width: 940}).add(
    banner({headline: '見出し', headlineRole: 'display', sub: '副題'}),
    bars([{label: '導入前', value: 76}, {label: '導入後', value: 31}], {max: 100, unit: '%', labelRole: 'stat'}),
    bars([{label: 'a', value: 2}, {label: 'b', value: 3}], {dir: 'v', stack: true, max: 6, labelRole: 'banner', height: 300}),
    plane({labelRole: 'stat', x: {label: '週', max: 8, step: 2}, y: {label: '%', max: 80, step: 20}, height: 420,
      points: [{id: 'a', at: [1, 70], label: '前', labelAt: 'left'}, {id: 'b', at: [7, 30], label: '後', labelAt: 'below'}],
      dims: [{from: 'a', to: 'b', label: '差', side: 'right'}], labels: [{at: [4, 10], text: '注'}]}),
  );
  const {laidOut, verdict} = await checkDiagram(d);
  assert.deepEqual(verdict.problems, []);
  const pl = laidOut.laidOut.find((b): b is LaidOutPlane => b.type === 'plane')!;
  assert.equal(pl.labelSize, ROLES.stat);
});

test('fill scales an opted-in size by no more than 72px; other diagrams keep 1.8x', () => {
  assert.equal(fillScaleLimit([banner({headline: 'a'}), bars([{label: 'a', value: 1}])]), 1.8);
  assert.equal(fillScaleLimit([bars([{label: 'a', value: 1}], {labelRole: 'stat'})]), 1.8, '34px x 1.8 = 61px is within the limit');
  const s = fillScaleLimit([group(banner({headline: 'a', headlineRole: 'display'}))]);
  assert.ok(s < 1.8 && Math.round(ROLES.display * s) <= 72, `display headline scale ${s}`);
});

test('fit counts plane and table text in the smallest size', async () => {
  const d = diagram({theme: 'blue', width: 940}).add(
    table([{label: 'a'}, {label: 'b'}], [['1', '2']]),
    plane({labelRole: 'stat', x: {max: 4}, y: {max: 4}, height: 320}),
  );
  const {laidOut} = await checkDiagram(d);
  assert.equal(laidOut.laidOut.find(b => b.type === 'table')!.bodySize, ROLES.body);
  const big = {...laidOut, maxDisplayHeight: 200, laidOut: laidOut.laidOut.filter(b => b.type === 'plane')};
  assert.equal(analyzeFit(big).effectiveFont, Math.round(ROLES.stat * analyzeFit(big).scale * 10) / 10, 'a plane-only figure is measured by its label size');
  const withTable = analyzeFit({...laidOut, maxDisplayHeight: 200});
  assert.equal(withTable.effectiveFont, Math.round(ROLES.body * withTable.scale * 10) / 10, 'the table text is the smallest');
});

test('caption({role: "display"}) already works', async () => {
  const {laidOut} = await checkDiagram(diagram({theme: 'blue'}).add(caption('大きい', {role: 'display'})));
  assert.equal((laidOut.laidOut[0] as {wrappedRuns: {size: number}[]}).wrappedRuns[0]!.size, ROLES.display);
});

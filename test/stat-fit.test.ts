// ADR 0024: a stat() value that does not fit its box is drawn smaller (whole px) instead of failing.
// Widths are measured here with the same measurer, so every assertion is a relation between widths, never a font's absolute number.
import test from 'node:test';
import assert from 'node:assert/strict';
import {box, checkDiagram, closeMeasurer, diagram, renderDiagram, stat} from '../lib/dsl.ts';
import {measureAtoms, textWidth} from '../lib/measure.ts';
import {canvasFontScale, canvasRoles, ROLES, statFitMin} from '../lib/tokens.ts';
import type {LaidOutBox} from '../lib/dsl.ts';

process.env["SVG_DIAGRAM_STRICT_WIDTH"] = '1'; // an unregistered size must throw, not measure 0 wide
test.after(() => closeMeasurer());

const PAD_X = 20; // a box's side padding: what is left for its text is w - 2 * PAD_X
async function widthAt(text: string, size: number): Promise<number> {
  const m = await measureAtoms([text], {size, weight: 700});
  return textWidth(atom => m.width(atom), text, size, 700);
}
async function laidBox(d: ReturnType<typeof diagram>) {
  const r = await checkDiagram(d);
  return {r, b: r.laidOut.laidOut.find((x): x is LaidOutBox => x.type === 'box')!};
}
/** The width the stat's text may take in a box of `d`'s layout (probed with a short value). */
async function availOf(make: () => ReturnType<typeof diagram>): Promise<number> {
  const {b} = await laidBox(make().add(stat('1', 'x')));
  return b.w - 2 * PAD_X;
}
/** A value (a run of '8') whose width at `big` px exceeds `avail` while its width at `small` px fits. */
async function valueBetween(avail: number, big: number, small: number): Promise<string> {
  for (let n = 1; n < 120; n++) {
    const text = '8'.repeat(n);
    if (await widthAt(text, big) > avail && await widthAt(text, small) <= avail) return text;
  }
  throw new Error('no value found');
}
const mk = () => diagram({theme: 'blue'});

test('a value that fits is not shrunk (nothing new on the box)', async () => {
  const {b} = await laidBox(mk().add(stat('76%', '導入前')));
  assert.equal(b.wrappedRuns[0]!.size, ROLES.stat);
  assert.equal(b.wrappedRuns[0]!.shrunkFrom, undefined);
  assert.equal(b.statShrunk, undefined);
});

test('a value that does not fit shrinks to the largest whole size that fits, and the box passes verification', async () => {
  const avail = await availOf(mk), lo = statFitMin(ROLES, ROLES.stat);
  const value = await valueBetween(avail, ROLES.stat, lo);
  const {r, b} = await laidBox(mk().add(stat(value, 'ラベル')));
  const size = b.wrappedRuns[0]!.size;
  assert.ok(size < ROLES.stat && size >= lo, `size ${size}`);
  assert.ok(await widthAt(value, size) <= avail + 0.5, 'fits at the chosen size');
  assert.ok(await widthAt(value, size + 1) > avail + 0.5, 'one px larger would not fit');
  assert.deepEqual(r.verdict.problems, []);
  assert.deepEqual(b.statShrunk, [{value, from: ROLES.stat, to: size}]);
  assert.equal(b.wrappedRuns[0]!.lines.length, 1);
  assert.equal(b.nowrapOverflow, undefined);
});

test('display shrinks too, and the size vocabulary stays two steps', async () => {
  const avail = await availOf(mk), lo = statFitMin(ROLES, ROLES.display);
  const value = await valueBetween(avail, ROLES.display, lo);
  const {r, b} = await laidBox(mk().add(stat(value, 'ラベル', {size: 'display'})));
  assert.ok(b.wrappedRuns[0]!.size < ROLES.display);
  assert.deepEqual(r.verdict.problems, []);
  assert.deepEqual(Object.keys(ROLES).sort(), ['banner', 'body', 'display', 'label', 'note', 'stat', 'title']);
});

test('a shrunk stat makes a shorter box, and the label under it keeps its size', async () => {
  const avail = await availOf(mk), lo = statFitMin(ROLES, ROLES.stat);
  const value = await valueBetween(avail, ROLES.stat, lo);
  const {b} = await laidBox(mk().add(stat(value, 'ラベル')));
  const wide = (await laidBox(diagram({theme: 'blue', width: 4000}).add(stat(value, 'ラベル')))).b;
  assert.ok(b.h < wide.h);
  assert.equal(b.wrappedRuns[1]!.size, ROLES.label);
});

test('below the floor it still fails, drawn at the floor', async () => {
  const avail = await availOf(mk), lo = statFitMin(ROLES, ROLES.stat);
  let value = '8';
  while (await widthAt(value, lo) <= avail) value += '8';
  const {r, b} = await laidBox(mk().add(stat(value, 'ラベル')));
  assert.equal(b.wrappedRuns[0]!.size, lo);
  assert.match(r.verdict.problems.join('\n'), /stat: value .* does not fit/);
});

test('a dense canvas shrinks below 24px, to round(24 x scale) at the least', async () => {
  const minText = 10, s = canvasFontScale(minText), roles = canvasRoles(s);
  const canvas = () => diagram({theme: 'blue', canvas: {width: 1280, height: 720, minText}});
  const lo = statFitMin(roles, roles.stat);
  assert.equal(lo, Math.round(24 * s));
  assert.ok(lo < 24);
  const avail = await availOf(canvas);
  const value = await valueBetween(avail, 24, lo); // too wide even at 24, fits at the floor
  const {r, b} = await laidBox(canvas().add(stat(value, 'ラベル')));
  const size = b.wrappedRuns[0]!.size;
  assert.ok(size < 24 && size >= lo, `size ${size}`);
  assert.ok(await widthAt(value, size) <= avail + 0.5 && await widthAt(value, size + 1) > avail + 0.5);
  assert.deepEqual(r.verdict.problems.filter(p => /stat:/.test(p)), []);
});

test('the same too-wide-at-24 value at scale 1 is not shrunk below 24px', async () => {
  const avail = await availOf(mk);
  let value = '8';
  while (await widthAt(value, 24) <= avail) value += '8';
  const {b} = await laidBox(mk().add(stat(value, 'ラベル')));
  assert.ok(b.wrappedRuns[0]!.size >= 24);
});

test('a canvas with a higher minText scales the floor with it', async () => {
  const canvas = () => diagram({theme: 'blue', canvas: {width: 1280, height: 720, minText: 36}});
  const roles = canvasRoles(canvasFontScale(36));
  const lo = statFitMin(roles, roles.stat);
  assert.ok(lo >= 36);
  const avail = await availOf(canvas);
  const value = await valueBetween(avail, roles.stat, lo);
  const {b} = await laidBox(canvas().add(stat(value, 'ラベル')));
  assert.ok(b.wrappedRuns[0]!.size >= 36 && b.wrappedRuns[0]!.size < roles.stat);
});

test('the emitted SVG draws the shrunk size and stays above the 14px lint floor', async () => {
  const avail = await availOf(mk), lo = statFitMin(ROLES, ROLES.stat);
  const value = await valueBetween(avail, ROLES.stat, lo);
  const r = await renderDiagram(mk().add(stat(value, 'ラベル')), {name: 'stat-fit', budget: 'measure'});
  const sizes = [...r.svg.matchAll(/font-size="(\d+)"/g)].map(m => Number(m[1]));
  assert.ok(sizes.length > 0 && sizes.every(n => n >= 14));
  assert.ok(sizes.some(n => n < ROLES.stat && n >= lo));
});

// ---- notification and the message when it still does not fit (ADR 0024 D5, D7) ----

test('a shrunk stat raises the info rule stat-fit-shrunk; accept keeps it an info with the reason; a fitting stat raises nothing', async () => {
  const avail = await availOf(mk), lo = statFitMin(ROLES, ROLES.stat);
  const value = await valueBetween(avail, ROLES.stat, lo);
  const {r, b} = await laidBox(mk().add(stat(value, 'ラベル')));
  const f = r.verdict.findings.filter(x => x.rule === 'stat-fit-shrunk');
  assert.equal(f.length, 1);
  assert.equal(f[0]!.severity, 'info');
  assert.ok(f[0]!.message.includes(`${ROLES.stat}px から ${b.wrappedRuns[0]!.size}px`));
  const accepted = (await checkDiagram(diagram({theme: 'blue', accept: {'stat-fit-shrunk': '細い列に置く'}}).add(stat(value, 'ラベル')))).verdict.findings.filter(x => x.rule === 'stat-fit-shrunk');
  assert.equal(accepted[0]!.severity, 'info');
  assert.match(accepted[0]!.message, /許容: 細い列に置く/);
  const fits = (await checkDiagram(mk().add(stat('76%', 'x')))).verdict.findings;
  assert.deepEqual(fits.filter(x => x.rule === 'stat-fit-shrunk'), []);
});

test('when even the floor does not fit, the message names the floor, the measured width, the box and a fix line', async () => {
  const avail = await availOf(mk), lo = statFitMin(ROLES, ROLES.stat);
  let value = '8';
  while (await widthAt(value, lo) <= avail) value += '8';
  const {r} = await laidBox(mk().add(stat(value, 'ラベル')));
  const msg = r.verdict.problems.find(p => /stat: value/.test(p))!;
  const needs = Number(/needs (\d+)px/.exec(msg)![1]), has = Number(/the box has (\d+)px/.exec(msg)![1]);
  assert.ok(msg.includes(`at the smallest size (${lo}px:`));
  assert.ok(Math.abs(needs - await widthAt(value, lo)) <= 1, 'the measured width at the floor');
  assert.ok(needs > has && Math.abs(has - avail) <= 1);
  assert.match(msg, /\n  fix: widen the box .*shorten the value.*unit in the label/);
  assert.ok(!msg.includes("size: 'stat'"));
});

test('other text is untouched: a long box title still wraps', async () => {
  const {b} = await laidBox(mk().add(box({title: '長い題'.repeat(30)})));
  assert.ok(b.wrappedRuns[0]!.lines.length > 1);
  assert.equal(b.wrappedRuns[0]!.shrunkFrom, undefined);
});

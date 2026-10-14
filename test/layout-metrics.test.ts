// node --test test/   — ADR 0014 U0: the layout-* metrics, their severity (layoutCheck) and the check CLI's exit code.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {layoutMetrics} from '../lib/layout-metrics.ts';
import {layoutSeverity, lintDiagram} from '../lib/rules.ts';
import {box, caption, checkDiagram, diagram, renderDiagram, row} from '../lib/dsl.ts';
import type {LaidOutBand} from '../lib/types/index.ts';

const run = (cwd: string, args: string[]) => spawnSync(process.execPath, [path.resolve(import.meta.dirname, '..', 'check-diagram.ts'), ...args], {encoding: 'utf8', cwd});
const libDsl = path.resolve(import.meta.dirname, '..', 'lib', 'dsl.ts');
const frame = (x: number, y: number, w: number, h: number) => ({type: 'group', tone: 'plain', x, y, w, h}) as unknown as LaidOutBand;
const textBox = (x: number, y: number, w: number, h: number, extra: object = {}) => ({type: 'box', title: 't', tone: 'plain', x, y, w, h, wrappedRuns: [{lines: ['t'], lineYs: [16], size: 16}], ...extra}) as unknown as LaidOutBand;
const all = (b: LaidOutBand[], width = 940) => layoutMetrics(b, {width}).map(m => m.rule);
// the whole-figure rules have their own test: small hand-built inputs would trip them
const rules = (b: LaidOutBand[]) => all(b).filter(r => !r.startsWith('layout-figure'));

test('layout-sibling-size: 444 / 440 is one grid step off; equal widths and a real flex difference are not', () => {
  assert.deepEqual(rules([frame(20, 20, 444, 100), frame(480, 20, 440, 100)]), ['layout-sibling-size']);
  assert.deepEqual(rules([frame(20, 20, 440, 100), frame(480, 20, 440, 100)]), []);
  assert.deepEqual(rules([frame(20, 20, 300, 100), frame(340, 20, 580, 100)]), []);
});

test('layout-sibling-size measures the drawn edges (the emitter snaps left and right edges separately)', () => {
  // 442 + 442 with a gap of 16 draws as 20..464 and 480..920 = widths 444 and 440
  const m = layoutMetrics([frame(20, 20, 442, 100), frame(478, 20, 442, 100)], {width: 940});
  assert.equal(m.filter(x => x.rule === 'layout-sibling-size').length, 1);
  assert.equal(m[0].data.measured, 4);
});

test('layout-gutter-uneven: needs 3 neighbours; gaps 8 and 4 differ by 4', () => {
  assert.deepEqual(rules([frame(20, 20, 100, 60), frame(128, 20, 100, 60), frame(232, 20, 100, 60)]), ['layout-gutter-uneven']);
  assert.deepEqual(rules([frame(20, 20, 100, 60), frame(128, 20, 100, 60), frame(236, 20, 100, 60)]), []);
});

test('layout-edge-misalign: 4px apart is flagged, 0 and 8px are not', () => {
  assert.deepEqual(rules([frame(20, 20, 200, 60), frame(24, 96, 200, 60)]).filter(r => r === 'layout-edge-misalign').length, 2); // left and right edge
  assert.deepEqual(rules([frame(20, 20, 200, 60), frame(20, 96, 200, 60)]), []);
  assert.deepEqual(rules([frame(20, 20, 200, 60), frame(28, 96, 200, 60)]), []);
});

test('layout-unused-space: 47px vs 48px, and 39% vs 40%', () => {
  // a frame at y=0 whose content ends at `content`: the free room is h - content
  const flagged = (h: number, content: number) => rules([frame(20, 0, 400, h), {type: 'row', x: 36, y: 0, w: 368, h: content, children: [], arrows: []} as unknown as LaidOutBand]).filter(r => r === 'layout-unused-space').length;
  assert.equal(flagged(116, 69), 0, '47px free');
  assert.equal(flagged(120, 72), 1, '48px free, exactly 40%');
  assert.equal(flagged(124, 76), 0, '48px free but 38.7%');
  assert.equal(flagged(136, 76), 1, '60px free, 44%');
});

test('layout-unused-space: a stamp strip under the content is not free room', () => {
  const stamped = textBox(20, 20, 400, 100, {stampW: 40});
  assert.deepEqual(rules([stamped]).filter(r => r === 'layout-unused-space'), []);
});

test('layout-unused-space: a group is judged by what sits inside it', () => {
  const g = frame(20, 20, 400, 300), inner = textBox(36, 60, 368, 52);
  assert.equal(rules([g, inner]).filter(r => r === 'layout-unused-space').length, 1);
  assert.equal(rules([g, {type: 'row', x: 36, y: 60, w: 368, h: 240, children: [], arrows: []} as unknown as LaidOutBand]).filter(r => r === 'layout-unused-space').length, 0);
});

test('layout-figure-offset and layout-figure-narrow read the content box, not the title', () => {
  const m = (bands: LaidOutBand[]) => all(bands);
  assert.ok(m([textBox(20, 20, 300, 60)]).includes('layout-figure-offset'));
  assert.ok(!m([textBox(320, 20, 300, 60)]).includes('layout-figure-offset'));
  assert.ok(m([textBox(320, 20, 300, 60)]).includes('layout-figure-narrow'));
  assert.ok(!m([textBox(20, 20, 900, 60)]).includes('layout-figure-narrow'));
  assert.deepEqual(m([{type: 'caption', x: 20, y: 20, w: 900, h: 24} as unknown as LaidOutBand, textBox(320, 100, 300, 60)]).filter(r => r === 'layout-figure-offset'), []);
});

test('annotations on a picture, boxes without a frame and boxes without text are not measured', () => {
  const pic = {type: 'image', backdrop: true, x: 20, y: 20, w: 600, h: 400, marks: [], plates: [], anchors: []} as unknown as LaidOutBand;
  const tall = (x: number, w: number, extra: object = {}) => textBox(x, 40, w, 200, extra);
  assert.equal(rules([pic, tall(40, 300)]).filter(r => r === 'layout-unused-space').length, 0, 'over a picture');
  assert.equal(rules([tall(40, 300)]).filter(r => r === 'layout-unused-space').length, 1, 'the same box on the page');
  assert.equal(rules([tall(20, 300, {frame: false})]).filter(r => r === 'layout-unused-space').length, 0, 'no frame is drawn');
  assert.equal(rules([textBox(20, 40, 300, 200, {wrappedRuns: []})]).filter(r => r === 'layout-unused-space').length, 0, 'an icon-only box has no text to measure against');
  assert.deepEqual(rules([textBox(20, 20, 444, 60, {frame: false}), textBox(480, 20, 440, 60, {frame: false})]), [], 'frame-less boxes are not frames');
  assert.deepEqual(rules([{type: 'quadrant', x: 0, y: 0, w: 600, h: 300, cells: [], texts: [], bubbles: []} as unknown as LaidOutBand]), [], 'a quadrant has no frame room to measure');
});

test('neighbours are frames of one row: the same top in different parents or of different kinds is not a row', () => {
  const g = (x: number, y: number, w: number, h: number) => frame(x, y, w, h);
  // two small groups inside different outer groups that happen to start at the same y, 16 / 48px apart: not one row
  const bands = [g(20, 20, 400, 200), g(36, 60, 100, 60), g(152, 60, 100, 60), g(440, 20, 400, 200), g(456, 60, 100, 60)];
  assert.deepEqual(rules(bands).filter(r => r === 'layout-gutter-uneven'), []);
  // a box and a group at the same top are different kinds
  assert.deepEqual(rules([frame(20, 20, 444, 100), textBox(480, 20, 440, 100)]).filter(r => r === 'layout-sibling-size'), []);
  // children with their own flex are not an equal division
  const row = {type: 'row', x: 20, y: 20, w: 900, h: 60, arrows: [], children: [textBox(20, 20, 444, 60, {flex: 2}), textBox(480, 20, 440, 60)]} as unknown as LaidOutBand;
  assert.deepEqual(rules([row]).filter(r => r === 'layout-sibling-size'), []);
});

test('layout-align-mixed: left and centre boxes in one row', () => {
  assert.ok(rules([textBox(20, 20, 200, 60, {align: 'left'}), textBox(236, 20, 200, 60, {align: 'center'})]).includes('layout-align-mixed'));
  assert.ok(!rules([textBox(20, 20, 200, 60, {align: 'center'}), textBox(236, 20, 200, 60, {align: 'center'})]).includes('layout-align-mixed'));
});

const sample = (extra: object = {}) => diagram({theme: 'blue', title: 'a short box beside a tall one', ...extra}).add(row([box({title: 'short'}), box({title: 'tall', body: 'l1\nl2\nl3\nl4\nl5\nl6\nl7\nl8'})]));

test('layoutCheck: info by default, warn for strict, info again when the rule is accepted; the SVG does not change', async () => {
  const sev = async (extra: object) => (await checkDiagram(sample(extra))).verdict.findings.filter(f => f.rule.startsWith('layout-')).map(f => `${f.rule}:${f.severity}`);
  const base = await sev({});
  assert.ok(base.length > 0 && base.every(s => s.endsWith(':info')), base.join());
  const strict = await sev({layoutCheck: 'strict'});
  assert.deepEqual(strict.map(s => s.split(':')[0]), base.map(s => s.split(':')[0]));
  assert.ok(strict.every(s => s.endsWith(':warn')), strict.join());
  const accepted = (await checkDiagram(sample({layoutCheck: 'strict', accept: {'layout-unused-space': '行の高さ揃えは許容'}}))).verdict.findings.find(f => f.rule === 'layout-unused-space');
  assert.equal(accepted?.severity, 'info');
  assert.match(accepted?.message ?? '', /許容/);
  const a = (await renderDiagram(sample({layoutCheck: 'strict'}), {name: 'x.svg', budget: 'cacheOnly'})).svg, b = (await renderDiagram(sample(), {name: 'x.svg', budget: 'cacheOnly'})).svg;
  assert.equal(a, b, 'layoutCheck is a check setting: the drawing is byte-identical');
});

test('layoutCheck: strict on a slide figure (day:) throws, because slide figures are not given the layout checks', () => {
  assert.throws(() => diagram({day: 1, layoutCheck: 'strict'}), /document figure/);
  assert.doesNotThrow(() => diagram({day: 1, layoutCheck: 'info'}));
});

test('layoutCheck: any other value throws; layoutSeverity reads it', () => {
  assert.throws(() => diagram({theme: 'blue', layoutCheck: 'warn' as never}), /layoutCheck/);
  assert.equal(layoutSeverity({}), 'info');
  assert.equal(layoutSeverity({layoutCheck: 'info'}), 'info');
  assert.equal(layoutSeverity({layoutCheck: 'strict'}), 'warn');
});

test('finding data carries the measured number, threshold and fix; lint without laid-out bands stays quiet', async () => {
  const f = (await checkDiagram(sample())).verdict.findings.find(x => x.rule === 'layout-unused-space');
  assert.equal(typeof f?.data?.measured, 'number');
  assert.equal(typeof f?.data?.threshold, 'number');
  assert.ok(f?.data?.fix);
  assert.deepEqual(lintDiagram({...sample(), laidOut: undefined}).filter(x => x.rule.startsWith('layout-')), []);
});

test('check CLI: layout-* never fails --strict by default; a layoutCheck: strict figure does; --format json has data', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svgd-layout-'));
  const src = (name: string, extra: string) => {
    const f = path.join(dir, name);
    fs.writeFileSync(f, `import {diagram, box, row} from ${JSON.stringify(libDsl)};
export default function define() {
  return diagram({theme: 'blue', title: 't'${extra}}).add(row([box({title: 'short'}), box({title: 'tall', body: 'l1\\nl2\\nl3\\nl4\\nl5\\nl6\\nl7\\nl8'})]));
}
`);
    return f;
  };
  const info = src('info.ts', ''), strict = src('strict.ts', ", layoutCheck: 'strict'");
  assert.equal(run(dir, ['--strict', info]).status, 0);
  const bad = run(dir, ['--strict', strict]);
  assert.equal(bad.status, 1, bad.stdout + bad.stderr);
  assert.match(bad.stdout, /layout-unused-space/);
  const json = JSON.parse(run(dir, ['--format', 'json', info]).stdout);
  const f = json.findings.find((x: {rule: string}) => x.rule === 'layout-unused-space');
  assert.ok(f && typeof f.data.measured === 'number' && f.severity === 'info');
  assert.ok(!/data/.test(run(dir, ['--verbose', info]).stdout), 'text output stays one line per finding');
  fs.rmSync(dir, {recursive: true, force: true});
});

test('caption alone has no layout findings', async () => {
  const f = (await checkDiagram(diagram({theme: 'blue', title: 'c'}).add(caption('hello')))).verdict.findings;
  assert.deepEqual(f.filter(x => x.rule.startsWith('layout-')), []);
});

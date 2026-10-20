import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {bars, checkDiagram, closeMeasurer, diagram, plane, renderDiagram} from '../lib/dsl.ts';
import {EMOJIS} from '../lib/icons.ts';
import {icon} from '../lib/dsl.ts';
import type {SpotlightOpt} from '../lib/types/core.ts';

process.env['SVG_DIAGRAM_STRICT_WIDTH'] = '1';
test.after(() => closeMeasurer());

const render = (d: ReturnType<typeof diagram>, reveal?: number) => renderDiagram(d, {name: 't.svg', budget: 'cacheOnly'}).then(async r => reveal === undefined ? r.svg : (await import('../lib/emit.ts')).emitSvg(r.laidOut, {reveal}));

// ---- #1 spotlight dim: 'fill' ----
const spotBars = (spotlight: SpotlightOpt) => diagram({theme: 'blue', spotlight}).add(bars([{id: 'a', label: '高い', value: 80}, {label: '低い', value: 30}], {max: 100, unit: '%'}));

test('spotlight dim fill: a dimmed bar keeps a pale fill; the default stays a dotted outline', async () => {
  const fill = await render(spotBars({ids: 'a', dim: 'fill'}));
  assert.match(fill, /<path d="M[\d. ,HVZ]+" fill="#e0d6c5"\/>/, 'the dimmed bar is filled with the border colour');
  assert.doesNotMatch(fill, /stroke-dasharray="2,5"/);
  const outline = await render(spotBars('a'));
  assert.match(outline, /stroke-dasharray="2,5"/);
  assert.doesNotMatch(outline, /fill="#e0d6c5"\/>/);
  assert.throws(() => diagram({theme: 'blue', spotlight: {ids: 'a', dim: 'wash' as never}}), /spotlight: \{dim\}.*'outline' or 'fill'/);
  assert.equal((await checkDiagram(spotBars({ids: 'a', dim: 'fill'}))).verdict.ok, true);
});

// ---- #2 bar tone ----
test('a bar takes a tone (accent / danger / muted); not together with series; a bad tone throws', async () => {
  const svg = await render(diagram({theme: 'blue'}).add(bars([{label: 'a', value: 5, tone: 'danger'}, {label: 'b', value: 4, series: 'b'}], {max: 10})));
  assert.match(svg, /fill="#b91c1c"/);
  assert.throws(() => bars([{label: 'a', value: 5, tone: 'danger', series: 'a'}]), /both series and tone/);
  assert.throws(() => bars([{label: 'a', value: 5, tone: 'red' as never}]), /tone for "a" must be accent, danger, or muted/);
});

// ---- #3 emoji ----
test('the emoji set has food, tools and faces (each one code point, see icons.test.ts for the font check)', () => {
  for (const n of ['ice', 'salad', 'package', 'carrot', 'riceplant', 'bread', 'hammer', 'smile', 'thinking'] as const) assert.equal([...icon.emoji(n)].length, 1, n);
  assert.equal(icon.emoji('ice'), '🧊');
  assert.ok(Object.keys(EMOJIS).length >= 50);
});

// ---- #4 preview --engine chromium exits ----
test('preview --engine chromium returns (the browser it starts is closed), well before the old 120 s hang', {timeout: 60000}, async t => {
  try { await import('playwright-chromium'); } catch { t.skip('playwright-chromium is not installed'); return; }
  const {writeFileSync, mkdtempSync, existsSync} = await import('node:fs');
  const {tmpdir} = await import('node:os');
  const dir = mkdtempSync(`${tmpdir()}/preview-`);
  const svg = await render(diagram({theme: 'blue'}).add(bars([{label: `${icon.emoji('ice')} 氷`, value: 5}], {max: 10})));
  writeFileSync(`${dir}/a.svg`, svg);
  const t0 = Date.now();
  const r = spawnSync(process.execPath, ['preview-svg.ts', `${dir}/a.svg`, `${dir}/a.png`, '1', '--engine', 'chromium'], {encoding: 'utf8', timeout: 45000});
  if (/executable doesn't exist|not downloaded/i.test(r.stderr + r.stdout)) { t.skip('no chromium browser downloaded'); return; }
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(`${dir}/a.png`));
  assert.ok(Date.now() - t0 < 30000, `took ${Date.now() - t0} ms`);
});

// ---- #5 plane path grow ----
const growPlane = () => diagram({theme: 'blue'}).add(plane({
  x: {max: 6}, y: {max: 100},
  points: [{id: 'a', at: [0, 10]}, {id: 'b', at: [2, 40], reveal: 1}, {id: 'c', at: [6, 80], reveal: 2}],
  paths: [{through: ['a', 'b', 'c'], smooth: true, grow: true}],
}));

test('a grow path draws the same curve only as far as the last point that is shown', async () => {
  const cmds = (svg: string) => /<path d="(M[^"]*C[^"]*)" fill="none" stroke="#1d5fa8" stroke-width="2"\/>/.exec(svg)?.[1] ?? '';
  const s0 = await render(growPlane(), 0), s1 = await render(growPlane(), 1), s2 = await render(growPlane(), 2);
  assert.equal(cmds(s0), '', 'stage 0: only the first point; no curve yet');
  const c1 = cmds(s1), c2 = cmds(s2);
  assert.equal((c1.match(/C/g) ?? []).length, 1);
  assert.equal((c2.match(/C/g) ?? []).length, 2);
  assert.ok(c2.startsWith(c1), 'the grown curve begins with the shorter one (same curve, not a redraw)');
});

test('a plain path still appears whole with its last point', async () => {
  const d = diagram({theme: 'blue'}).add(plane({x: {max: 6}, y: {max: 100}, points: [{id: 'a', at: [0, 10]}, {id: 'b', at: [2, 40], reveal: 1}, {id: 'c', at: [6, 80], reveal: 2}], paths: [{through: ['a', 'b', 'c'], smooth: true}]}));
  assert.doesNotMatch(await render(d, 1), /stroke="#1d5fa8" stroke-width="2"\/>/);
  assert.match(await render(d, 2), /stroke="#1d5fa8" stroke-width="2"\/>/);
});

// ---- #6 point labels get out of the way ----
test('a point label that lands on the plane\'s ink moves to a free side; an explicit side or offset is kept', async () => {
  const pts = (extra: object) => diagram({theme: 'blue'}).add(plane({
    x: {max: 10}, y: {max: 10}, height: 300,
    points: [{id: 'a', at: [2, 2]}, {id: 'b', at: [5, 5], label: '中ほど', ...extra}, {id: 'c', at: [8, 8]}],
    paths: [{through: ['a', 'b', 'c']}],
  }));
  const auto = (await checkDiagram(pts({}))).verdict;
  assert.deepEqual(auto.problems, [], auto.problems.join('\n'));
  const fixed = (await checkDiagram(pts({labelAt: 'right'}))).verdict;
  assert.ok(fixed.problems.some(p => /label "中ほど" overlaps a path/.test(p)), 'written out, a colliding side is still reported');
  const moved = await render(pts({labelOffset: [0, -40]}));
  assert.match(moved, /中ほど/);
});

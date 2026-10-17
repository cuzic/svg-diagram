// ADR 0023 U1: appearance: 'auto' — drawn light, plus a prefers-color-scheme: dark rule per colour the figure uses.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {bars, box, caption, checkDiagram, closeMeasurer, connect, diagram, renderDiagram, row} from '../lib/dsl.ts';
import {DARK_COLORS, LIGHT_COLORS, darkOf, recolor, wcagRatio, NO_TONES} from '../lib/tokens.ts';
import {autoBlock, autoSides, stripAutoBlock} from '../lib/appearance-auto.ts';
import {scopeRules} from '../lib/scope-style.ts';
import {inlineSvg} from '../lib/markdown-target.ts';
import {buildDeck} from '../lib/deck-html.ts';
import {rasterize} from '../lib/raster.ts';
import {geometryChecks} from '../lib/svg-lint.ts';

process.env.SVG_DIAGRAM_STRICT_WIDTH = '1';
test.after(() => closeMeasurer());

type Look = 'light' | 'dark' | 'auto' | undefined;
const figure = (appearance: Look, extra: {transparent?: boolean} = {}) => diagram({theme: 'blue', title: '試験図', ...(appearance ? {appearance} : {}), ...extra})
  .add(caption('見出し', {tone: 'muted'}), row([box({id: 'a', title: '入口', tone: 'accent'}), box({id: 'b', title: '出口', tone: 'danger'})]), connect('a:right', 'b:left'), bars([{label: '甲', value: 3, tone: 'danger'}, {label: '乙', value: 5}], {max: 5}));
const draw = async (appearance: Look, extra: {transparent?: boolean} = {}) => (await renderDiagram(figure(appearance, extra), {name: 'x.svg', budget: 'cacheOnly'})).svg;

test('auto minus its @media block and its root attribute is the light figure; the other appearances are unchanged', async () => {
  const [light, auto, none, dark] = [await draw('light'), await draw('auto'), await draw(undefined), await draw('dark')];
  assert.equal(none, light);
  assert.match(auto, /^<svg data-appearance="auto" /);
  assert.ok(auto.includes('@media (prefers-color-scheme: dark)'));
  assert.equal(stripAutoBlock(auto).replace(' data-appearance="auto"', ''), light);
  assert.match(dark, /^<svg data-appearance="dark" /);
  assert.ok(!light.includes('@media') && !dark.includes('@media'));
});

test('the block holds one rule per (attribute, colour) the figure uses, in order, with the dark colour of the table', async () => {
  const auto = await draw('auto');
  const rules = [...auto.matchAll(/^ {6}svg\[data-appearance="auto"\] \[(fill|stroke|stop-color|flood-color|color)="(#[0-9a-f]{6})" i\] \{ \1: (#[0-9a-f]{6}) \}$/gm)];
  const body = stripAutoBlock(auto);
  const used = new Map<string, Set<string>>();
  for (const m of body.matchAll(/\s(fill|stroke|stop-color|flood-color|color)="(#[0-9a-f]{6})"/g)) (used.get(m[1]) ?? used.set(m[1], new Set()).get(m[1])!).add(m[2]);
  let expected = 0;
  for (const set of used.values()) for (const hex of set) if (darkOf(hex) !== hex) expected++;
  assert.ok(expected > 3);
  assert.equal(rules.length, expected);
  for (const [, , light, dark] of rules) assert.equal(dark, darkOf(light));
  const order = ['fill', 'stroke', 'stop-color', 'flood-color', 'color'];
  const keys = rules.map(m => [order.indexOf(m[1]), m[2]] as const);
  assert.deepEqual(keys, [...keys].sort((x, y) => x[0] - y[0] || (x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0)));
  assert.equal(autoBlock(body, NO_TONES), autoBlock(auto, NO_TONES), 'the same figure gives the same block');
  // a colour the figure does not use has no rule
  const unused = ['#a8632b', '#f1e3d3'].filter(c => !body.includes(c)); // the amber theme is not in a blue figure
  for (const c of unused) assert.ok(!auto.includes(`"${c}" i`));
});

test('transparent: no background rectangle, so no rule for the page colour fill on a rect', async () => {
  const solid = await draw('auto'), clear = await draw('auto', {transparent: true});
  assert.ok(/<rect x="0" y="0" [^>]*fill="#ffffff"/.test(solid));
  assert.ok(!/<rect x="0" y="0" [^>]*fill="#ffffff"/.test(clear));
  assert.match(clear, /data-assumed-bg="#ffffff"/);
});

test('html together with auto throws (the HTML form paints with style attributes); svg-only is fine', async () => {
  await assert.rejects(renderDiagram(figure('auto'), {name: 'x.svg', budget: 'cacheOnly', html: true}), /SVG only/);
  const r = await renderDiagram(figure('light'), {name: 'x.svg', budget: 'cacheOnly', html: true});
  assert.ok(r.html);
});

test('an invalid appearance is rejected, and auto is accepted', () => {
  assert.throws(() => diagram({theme: 'blue', appearance: 'night' as never}), /'auto'/);
  assert.doesNotThrow(() => diagram({theme: 'blue', appearance: 'auto'}));
});

test('the geometry checks (lint-svg default) read an auto figure like the light one', async () => {
  const auto = geometryChecks(await draw('auto'), undefined), light = geometryChecks(await draw('light'), undefined);
  assert.deepEqual(auto, light);
});

test('scopeRules: a rule inside @media gets the id too; css without @media is scoped as before', () => {
  const plain = '\n    text { font-family: x; }\n    .mono, .em { y: 1 }\n  ';
  const before = (css: string, pre: string) => css.replace(/(^|\})\s*([^{}@]+)\{/g, (_m, a: string, sel: string) => `${a}\n#${pre} ${sel.split(',').map(x => x.trim()).join(`, #${pre} `)} {`); // the version before @media was understood
  assert.equal(scopeRules(plain, 's1'), before(plain, 's1'));
  const css = '\n    text { a: 1 }\n    @media (prefers-color-scheme: dark) {\n      svg[data-appearance="auto"] [fill="#ffffff" i] { fill: #1b1a17 }\n      .x { b: 2 }\n    }\n    .y { c: 3 }';
  const out = scopeRules(css, 's1');
  assert.match(out, /#s1 text \{/);
  assert.match(out, /@media \(prefers-color-scheme: dark\) \{\s*#s1 svg\[data-appearance="auto"\] \[fill="#ffffff" i\], svg#s1\[data-appearance="auto"\] \[fill="#ffffff" i\] \{ fill: #1b1a17 \}/);
  assert.match(out, /#s1 \.x \{ b: 2 \}\s*\}/);
  assert.match(out, /\}\s*#s1 \.y \{ c: 3 \}/);
});

test('inlineSvg and deck: the dark rules are confined to their own figure', async () => {
  const auto = await draw('auto');
  const inline = inlineSvg(auto, undefined, new Map());
  const id = /^<svg [^>]*\sid="(sd[^"]+)"/.exec(inline)![1];
  const rulesOf = (css: string) => css.split('\n').filter(l => /\[fill=|\[stroke=/.test(l));
  const inlineCss = /<style>([\s\S]*?)<\/style>/.exec(inline)![1];
  assert.ok(rulesOf(inlineCss).length > 3);
  for (const l of rulesOf(inlineCss)) assert.match(l, new RegExp(`^\\s*#${id} svg\\[data-appearance="auto"\\] .*, svg#${id}\\[data-appearance="auto"\\] `));
  const deck = buildDeck([{name: 'a', svg: auto}, {name: 'b', svg: auto}], {css: '', js: ''});
  const sheet = deck.split('<style>').slice(1).join('').split('</style>')[0];
  for (const l of rulesOf(sheet)) assert.match(l, /^\s*#s[12] svg\[data-appearance="auto"\] /);
  assert.ok(!/<section[^>]* slide-dark/.test(deck), 'an auto figure does not darken the deck frame');
});

test('resvg draws an auto figure on its light side (it does not evaluate the media query)', async () => {
  const auto = await draw('auto'), light = await draw('light');
  const [a, l] = [await rasterize(auto, {scale: 1, png: true}), await rasterize(light, {scale: 1, png: true})];
  assert.deepEqual(a.png, l.png);
});

// ---- U2: the checks run on both colour sides ------------------------------------------------------------------------------
const pair = (tones: object | undefined, extra: {transparent?: boolean} = {}) => diagram({theme: 'blue', title: '図', appearance: 'auto', ...(tones ? {tones} : {}), ...extra})
  .add(row([box({title: '入口', body: '本文', tone: 'accent'}), box({title: '出口', body: '本文'})]));
const contrast = async (d: ReturnType<typeof pair>) => (await checkDiagram(d)).verdict.findings.filter(f => f.rule === 'a11y-text-contrast');
const MARK = '(暗い配色)';

test('verifyDiagram: a figure that is only unreadable in the dark scheme is told so, marked; a light-side problem carries no mark', async () => {
  assert.deepEqual(await contrast(pair(undefined)), []);
  // the dark colour of the accent fill equals the dark text colour: the light side is fine, the dark side is 1:1
  const text = darkOf('#22201b');
  const darkOnly = await contrast(pair({accent: {fill: '#e6d3bd', dark: {fill: text}}}));
  assert.ok(darkOnly.length > 0);
  for (const f of darkOnly) assert.ok(f.message.endsWith(MARK), f.message);
  assert.ok(darkOnly.some(f => f.message.includes(`${wcagRatio(text, text).toFixed(1)}:1`)));
  // a fill that is unreadable in light and is no token (it stays as it is in dark): the light side reports it, unmarked
  const tones = {accent: {fill: '#222222'}};
  const a = await contrast(pair(tones));
  assert.ok(a.some(f => !f.message.endsWith(MARK)));
  const light = await contrast({...pair(tones), appearance: 'light'} as never);
  assert.deepEqual(a.filter(f => !f.message.endsWith(MARK)), light, 'the unmarked ones are the light figure\'s own findings');
});

test('lint-svg (geometry): the dark side is checked as its own SVG; a dark-only problem is reported with the mark, a clean figure passes', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-lint-'));
  const write = async (name: string, d: ReturnType<typeof pair>) => { const f = path.join(dir, name); fs.writeFileSync(f, (await renderDiagram(d, {name, budget: 'cacheOnly'})).svg); return f; };
  const lint = (f: string, ...a: string[]) => spawnSync(process.execPath, [path.join(import.meta.dirname, '..', 'lint-svg.ts'), f, ...a], {encoding: 'utf8'});
  const clean = lint(await write('clean.svg', pair(undefined)), '--strict');
  assert.equal(clean.status, 0, clean.stdout + clean.stderr);
  const bad = lint(await write('bad.svg', pair({accent: {fill: '#e6d3bd', dark: {fill: darkOf('#22201b')}}})), '--strict');
  assert.notEqual(bad.status, 0, bad.stdout);
  assert.match(bad.stdout, /bad\.svg \(暗い配色\)/);
  assert.ok(!/bad\.svg\n/.test(bad.stdout), 'the light side has nothing to report');
  fs.rmSync(dir, {recursive: true});
});

test('autoSides: light is the figure without its block; dark has the block\'s colours; each side keeps its own palette', async () => {
  const {light, dark} = autoSides(await draw('auto'));
  assert.equal(light.replace(' data-appearance="auto"', ''), await draw('light'));
  assert.ok(!light.includes('@media'));
  const colours = (s: string) => new Set([...s.matchAll(/\s(?:fill|stroke)="(#[0-9a-f]{6})"/g)].map(m => m[1]));
  for (const c of colours(light)) assert.ok(LIGHT_COLORS.has(c), `light side has ${c}`);
  for (const c of colours(dark)) assert.ok(DARK_COLORS.has(c), `dark side has ${c}`);
  assert.equal(dark, recolor(NO_TONES, light, 'dark'), 'for a figure without tone overrides the block and the table agree');
});

test('transparent + auto: the dark side assumes the dark page, the light side the light page', async () => {
  const {light, dark} = autoSides(await draw('auto', {transparent: true}));
  assert.match(light, /data-assumed-bg="#ffffff"/);
  assert.match(dark, new RegExp(`data-assumed-bg="${darkOf('#ffffff')}"`));
});

test('lint-svg: a dark colour left in the light side is off-token (the dark palette is not added to the light side)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-lint-'));
  const f = path.join(dir, 'mixed.svg');
  fs.writeFileSync(f, (await draw('auto')).replace(/(<rect x="0" y="0"[^>]*fill=")#ffffff"/, `$1${darkOf('#ffffff')}"`));
  const r = spawnSync(process.execPath, [path.join(import.meta.dirname, '..', 'lint-svg.ts'), f], {encoding: 'utf8'});
  assert.match(r.stdout, /off-token-color\][\s\S]*outside the token set: #1b1a17/, r.stdout);
  fs.rmSync(dir, {recursive: true});
});

// ADR 0023 U1: appearance: 'auto' — drawn light, plus a prefers-color-scheme: dark rule per colour the figure uses.
import test from 'node:test';
import assert from 'node:assert/strict';
import {bars, box, caption, closeMeasurer, connect, diagram, renderDiagram, row} from '../lib/dsl.ts';
import {darkOf} from '../lib/tokens.ts';
import {autoBlock, stripAutoBlock} from '../lib/appearance-auto.ts';
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
  assert.equal(autoBlock(body), autoBlock(auto), 'the same figure gives the same block');
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

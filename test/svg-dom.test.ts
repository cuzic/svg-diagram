// lib/svg-dom.ts: the XML reader, colours, transforms and the cascade.
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseXml, elements, textOf, closest, parseColor, parseTransform, multiply, apply, computeStyles, IDENTITY, type El} from '../lib/svg-dom.ts';

const svg = (inner: string, attrs = '') => `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${inner}</svg>`;
const find = (root: El, id: string) => elements(root).find(e => e.attrs.id === id)!;
const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);

// ---- the reader ----

test('parseXml: the tree, attributes of either quote, self-closing tags, document order', () => {
  const root = parseXml(svg(`<g id="a" x='1' y="2"><rect id="r"/><text id="t">hi</text></g>`, 'width="10"'));
  assert.equal(root.tag, 'svg');
  assert.equal(root.attrs.width, '10');
  const g = find(root, 'a');
  assert.deepEqual([g.attrs.x, g.attrs.y], ['1', '2']);
  assert.deepEqual(g.children.map(c => (c as El).tag), ['rect', 'text']);
  assert.equal((find(root, 'r').parent), g);
  assert.ok(find(root, 'r').order < find(root, 't').order);
  assert.equal(root.parent, null);
});

test('parseXml: entities, numeric references and CDATA in text and attributes', () => {
  const root = parseXml(svg(`<text id="t" data-x="a &amp; &quot;b&quot;">1 &lt; 2 &amp;&#x41;&#66; <![CDATA[<raw & text>]]></text>`));
  assert.equal(find(root, 't').attrs['data-x'], 'a & "b"');
  assert.equal(textOf(find(root, 't')), '1 < 2 &AB <raw & text>');
});

test('parseXml: comments, processing instructions and a doctype are skipped', () => {
  const root = parseXml(`<?xml version="1.0"?><!DOCTYPE svg><!-- c --><svg xmlns="http://www.w3.org/2000/svg"><!-- <rect/> --><g id="g"/></svg>`);
  assert.deepEqual(elements(root).map(e => e.tag), ['svg', 'g']);
});

test('parseXml: unknown entities are kept as written, and text between elements is kept', () => {
  const root = parseXml(svg(`<text id="t">a &nbsp; b</text>`));
  assert.equal(textOf(find(root, 't')), 'a &nbsp; b');
});

test('parseXml refuses what is not XML, saying what', () => {
  for (const [src, why] of [
    ['<svg xmlns="http://www.w3.org/2000/svg"><g></svg>', /closes|never closed/],
    ['<svg xmlns="http://www.w3.org/2000/svg"><g data-x></g></svg>', /attribute without a quoted value/],
    ['<svg xmlns="http://www.w3.org/2000/svg"><!-- never', /unterminated comment/],
    ['<svg xmlns="http://www.w3.org/2000/svg"><![CDATA[ never', /unterminated CDATA/],
    ['<svg xmlns="http://www.w3.org/2000/svg"></g></svg>', /closes nothing|never closed/],
    ['<svg xmlns="http://www.w3.org/2000/svg">', /never closed/],
    ['<g/>', /no <svg> element/],
    ['', /no <svg> element/],
  ] as const) assert.throws(() => parseXml(src), why, src);
});

test('elements, textOf and closest', () => {
  const root = parseXml(svg(`<g id="a" data-k="1"><g id="b"><text id="t">x<tspan>y</tspan>z</text></g></g>`));
  assert.deepEqual(elements(root).map(e => e.tag), ['svg', 'g', 'g', 'text', 'tspan']);
  assert.equal(textOf(find(root, 't')), 'xyz');
  assert.equal(closest(find(root, 't'), e => e.attrs['data-k'] !== undefined), find(root, 'a'));
  assert.equal(closest(find(root, 'a'), e => e.tag === 'text'), null);
  assert.equal(closest(find(root, 't'), e => e === find(root, 't')), find(root, 't'));
});

// ---- colours ----

test('parseColor: hex in 3, 4, 6 and 8 digits', () => {
  assert.deepEqual(parseColor('#fff'), {r: 255, g: 255, b: 255, a: 1});
  assert.deepEqual(parseColor('#1f5fa8'), {r: 0x1f, g: 0x5f, b: 0xa8, a: 1});
  assert.deepEqual(parseColor('#F00'), {r: 255, g: 0, b: 0, a: 1});
  assert.deepEqual(parseColor('#f008'), {r: 255, g: 0, b: 0, a: 0x88 / 255});
  const c = parseColor('#1f5fa880')!;
  assert.deepEqual([c.r, c.g, c.b], [0x1f, 0x5f, 0xa8]);
  close(c.a, 0x80 / 255);
  assert.equal(parseColor('#12345'), null);
  assert.equal(parseColor('#gggggg'), null);
});

test('parseColor: rgb(), rgba(), percentages, names, transparent, currentColor', () => {
  assert.deepEqual(parseColor('rgb(1, 2, 3)'), {r: 1, g: 2, b: 3, a: 1});
  assert.deepEqual(parseColor('rgba(1,2,3,0.5)'), {r: 1, g: 2, b: 3, a: 0.5});
  assert.deepEqual(parseColor('rgb(1 2 3 / 25%)'), {r: 1, g: 2, b: 3, a: 0.25});
  const p = parseColor('rgb(100%, 50%, 0%)')!;
  assert.deepEqual([p.r, p.g, p.b], [255, 127.5, 0]);
  assert.deepEqual(parseColor('White'), {r: 255, g: 255, b: 255, a: 1});
  assert.deepEqual(parseColor('transparent'), {r: 0, g: 0, b: 0, a: 0});
  assert.deepEqual(parseColor('currentColor', '#102030'), {r: 16, g: 32, b: 48, a: 1});
  assert.deepEqual(parseColor('currentColor'), {r: 0, g: 0, b: 0, a: 1});
});

test('parseColor: none, a url() paint, and anything unknown are not colours', () => {
  for (const v of ['none', 'url(#grad)', 'url("#g") red', 'notacolour', '', 'rgb(1,2)', 'hsl(0,0%,0%)']) assert.equal(parseColor(v), null, v);
});

// ---- transforms ----

test('parseTransform: each function', () => {
  assert.deepEqual(parseTransform('translate(3 4)'), [1, 0, 0, 1, 3, 4]);
  assert.deepEqual(parseTransform('translate(3)'), [1, 0, 0, 1, 3, 0]);
  assert.deepEqual(parseTransform('scale(2)'), [2, 0, 0, 2, 0, 0]);
  assert.deepEqual(parseTransform('scale(2, 3)'), [2, 0, 0, 3, 0, 0]);
  assert.deepEqual(parseTransform('matrix(1 2 3 4 5 6)'), [1, 2, 3, 4, 5, 6]);
  const sx = parseTransform('skewX(45)'); close(sx[2], 1);
  const sy = parseTransform('skewY(45)'); close(sy[1], 1);
});

test('parseTransform: rotate turns about the origin or about a centre', () => {
  const [x, y] = apply(parseTransform('rotate(90)'), 1, 0); close(x, 0); close(y, 1);
  const [cx, cy] = apply(parseTransform('rotate(90 10 10)'), 10, 10); close(cx, 10); close(cy, 10);
  const [px, py] = apply(parseTransform('rotate(90 10 10)'), 20, 10); close(px, 10); close(py, 20);
});

test('parseTransform: a list applies left to right as nested coordinate systems (the last function acts on the points first)', () => {
  const [x, y] = apply(parseTransform('translate(10 0) scale(2)'), 1, 1);
  assert.deepEqual([x, y], [12, 2]);
  const [x2, y2] = apply(parseTransform('scale(2) translate(10 0)'), 1, 1);
  assert.deepEqual([x2, y2], [22, 2]);
});

test('parseTransform: nothing, nonsense and unknown functions are the identity; matrix needs six numbers', () => {
  for (const v of [undefined, '', 'nonsense', 'wobble(3)', 'matrix(1 2 3)', 'translate(abc)']) assert.deepEqual(parseTransform(v), IDENTITY, String(v));
});

test('multiply composes like the transforms it stands for', () => {
  const m = multiply(parseTransform('translate(5 6)'), parseTransform('rotate(90)'));
  const [x, y] = apply(m, 1, 0);
  close(x, 5); close(y, 7);
  assert.deepEqual(multiply(IDENTITY, [1, 2, 3, 4, 5, 6]), [1, 2, 3, 4, 5, 6]);
});

// ---- the cascade ----

const styleOf = (inner: string, id: string, attrs = '') => { const root = parseXml(svg(inner, attrs)); return computeStyles(root).get(find(root, id))!; };

test('defaults are the SVG initial values', () => {
  const s = styleOf('<rect id="r"/>', 'r');
  assert.deepEqual([s.fill, s.stroke, s.strokeWidth, s.opacity, s.fillOpacity, s.fontWeight, s.textAnchor], ['black', 'none', 1, 1, 1, 400, 'start']);
});

test('inherited properties pass down through groups; opacity does not', () => {
  const s = styleOf('<g fill="red" stroke="blue" stroke-width="3" fill-opacity="0.5" opacity="0.4" font-size="20" text-anchor="middle"><g><rect id="r"/></g></g>', 'r');
  assert.deepEqual([s.fill, s.stroke, s.strokeWidth, s.fillOpacity, s.opacity, s.fontSize, s.textAnchor], ['red', 'blue', 3, 0.5, 1, 20, 'middle']);
});

test('an element\'s own attribute beats what it inherits', () => {
  const s = styleOf('<g fill="red"><rect id="r" fill="green"/></g>', 'r');
  assert.equal(s.fill, 'green');
});

test('cascade order: presentation attribute < <style> rule < style=""', () => {
  const css = '<style>.a { fill: blue } #r { stroke: black }</style>';
  assert.equal(styleOf(`${css}<rect id="r" class="a" fill="red"/>`, 'r').fill, 'blue');
  assert.equal(styleOf(`${css}<rect id="r" class="a" fill="red" style="fill: green"/>`, 'r').fill, 'green');
  assert.equal(styleOf(`${css}<rect id="r" class="a" fill="red" style="fill: green; stroke: pink"/>`, 'r').stroke, 'pink');
});

test('specificity: id beats class beats tag, whatever the order; equal specificity: the later rule', () => {
  const r = (css: string) => styleOf(`<style>${css}</style><rect id="r" class="c"/>`, 'r').fill;
  assert.equal(r('#r { fill: red } .c { fill: green } rect { fill: blue }'), 'red');
  assert.equal(r('rect { fill: blue } .c { fill: green } #r { fill: red }'), 'red');
  assert.equal(r('rect { fill: blue } .c { fill: green }'), 'green');
  assert.equal(r('.c { fill: red } .c { fill: green }'), 'green');
  assert.equal(r('rect.c { fill: red } .c { fill: green }'), 'red');
});

test('selectors: lists, compound classes, descendants and *; ones it cannot read are ignored', () => {
  const s = (css: string, attrs = 'class="a b"') => styleOf(`<style>${css}</style><g class="grp"><rect id="r" ${attrs}/></g>`, 'r').fill;
  assert.equal(s('.x, .b { fill: red }'), 'red');
  assert.equal(s('.a.b { fill: red }'), 'red');
  assert.equal(s('.a.zz { fill: red }'), 'black');
  assert.equal(s('.grp rect { fill: red }'), 'red');
  assert.equal(s('.other rect { fill: red }'), 'black');
  assert.equal(s('* { fill: red }'), 'red');
  assert.equal(s('rect:hover { fill: red } > rect { fill: red } [x] { fill: red }'), 'black');
  assert.equal(s('@media print { .a { fill: red } } .b { fill: green }'), 'green');
});

test('CSS comments and !important do not get in the way; property names are case-insensitive', () => {
  assert.equal(styleOf('<style>/* x */ .a { /* y */ FILL: red !important }</style><rect id="r" class="a"/>', 'r').fill, 'red');
});

test('font-size: px, em of the parent, rem, pt, percent', () => {
  const fs = (v: string) => styleOf(`<g font-size="20"><text id="t" font-size="${v}"/></g>`, 't').fontSize;
  assert.equal(fs('14'), 14);
  assert.equal(fs('14px'), 14);
  assert.equal(fs('1.5em'), 30);
  assert.equal(fs('150%'), 30);
  assert.equal(fs('1rem'), 16);
  assert.equal(fs('12pt'), 16);
  assert.equal(fs('nonsense'), 20); // an invalid value is ignored: the parent's size stays
});

test('font-weight: keywords and numbers', () => {
  const fw = (v: string, parent = '') => styleOf(`<g ${parent}><text id="t" font-weight="${v}"/></g>`, 't').fontWeight;
  assert.equal(fw('bold'), 700);
  assert.equal(fw('normal'), 400);
  assert.equal(fw('600'), 600);
  assert.equal(fw('bolder', 'font-weight="400"'), 700);
  assert.equal(fw('lighter', 'font-weight="700"'), 400);
  assert.equal(fw('bold', 'font-weight="300"'), 700);
});

test('currentColor resolves through `color`, which is inherited', () => {
  const s = styleOf('<g color="#102030"><rect id="r" fill="currentColor"/></g>', 'r');
  assert.equal(s.fill, 'currentColor');
  assert.deepEqual(parseColor(s.fill, s.color), {r: 16, g: 32, b: 48, a: 1});
});

test('font-family is read from a rule on the element or its parents', () => {
  const s = styleOf(`<style>text { font-family: 'Yu Gothic', sans-serif; }</style><g><text id="t">x</text></g>`, 't');
  assert.equal(s.fontFamily, "'Yu Gothic', sans-serif");
});

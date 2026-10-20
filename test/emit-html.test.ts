import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {box, caption, diagram, closeMeasurer, renderDiagram, row, table, raw} from '../lib/dsl.ts';
import {configureMeasure} from '../lib/measure.ts';
import {textBox} from '../lib/font-metrics.ts';
import {PALETTE} from '../lib/tokens.ts';

process.env['SVG_DIAGRAM_STRICT_WIDTH'] = '1';
test.after(() => closeMeasurer());

const make = (html = true) => {
  const d = diagram({theme: 'blue'});
  d.add(caption('見出し <ok> & more'));
  d.add(box({title: '許可', body: 'ユーザーが決める', id: 'a'}));
  d.add(box({title: '実行', body: '一つずつ', id: 'b'}));
  d.connect('a', 'b');
  return renderDiagram(d, {name: 't.svg', budget: 'cacheOnly', html});
};

test('renderDiagram builds html only when asked', async () => {
  assert.equal((await make(false)).html, undefined);
  assert.equal(typeof (await make(true)).html, 'string');
});

test('boxes, text and connectors are HTML elements', async () => {
  const {html} = await make();
  assert.match(html!, /<div class="sd-b" /);
  assert.match(html!, /class="sd-t"[^>]*>許可</);
  // the connector and its arrowhead are CSS boxes clipped to a polygon, not SVG
  assert.doesNotMatch(html!, /<svg|<path|marker-end/);
  assert.match(html!, /<div class="sd-s" style="[^"]*clip-path:polygon\(nonzero,/);
  // text is escaped, and drawn once (HTML), not also as SVG <text>
  assert.match(html!, /見出し &lt;ok&gt; &amp; more/);
  assert.doesNotMatch(html!, /<text[^>]*>許可/);
});

test('every text line is pre-broken: white-space pre, a fixed width, no re-wrapping', async () => {
  const {html} = await make();
  assert.match(html!, /\.sd-t \{ position: absolute; white-space: pre; \}/);
  assert.match(html!, /class="sd-t" style="left:[\d.]+px;top:[\d.]+px;width:[\d.]+px;text-align:left;font-size:\d+px;font-weight:\d+;line-height:\d+px;color:#/);
});

test('a table is a real <table>: <th> headers with scope, fixed columns, text lines placed over the cells', async () => {
  const d = diagram({theme: 'blue'});
  d.add(table([{label: '層', flex: 1}, {label: '役割', flex: 3}], [['画面', '入力を受ける'], ['業務', '規則を適用する']], {rowHeader: true, title: '構成'}));
  const {html} = await renderDiagram(d, {name: 't.svg', budget: 'cacheOnly', html: true});
  assert.match(html!, /<table style="width:[\d.]+px"><colgroup><col style="width:[\d.]+px"><col/);
  assert.match(html!, /<th scope="col"[^>]*>.*層/);
  assert.match(html!, /<th scope="row"[^>]*>.*画面/);
  assert.match(html!, /<td[^>]*>.*入力を受ける/);
  assert.doesNotMatch(html!, /<svg/, 'a table needs no SVG overlay');
});

test('every other part keeps its shapes in SVG but its words are HTML (no <text> left)', async () => {
  const d = diagram({theme: 'blue'});
  d.add(box({title: '手順', body: '本文 **強調** 🙂', step: 1, tag: 'new', id: 'a'}));
  d.add(box({title: '次', id: 'b'}));
  d.connect('a', 'b', {label: 'ラベル'});
  const {html} = await renderDiagram(d, {name: 't.svg', budget: 'cacheOnly', html: true});
  assert.doesNotMatch(html!, /<text/);
  assert.match(html!, /class="sd-t sd-am"[^>]*>ラベル</, 'a centred label is HTML, shifted by CSS');
  assert.match(html!, /<span class="sd-e">🙂<\/span>/);
});

test('raw() stays the author\'s SVG, text included', async () => {
  const d = diagram({theme: 'blue'});
  d.add(raw({h: 60, draw: ({x, y}: {x: number; y: number}) => `<text x="${x + 10}" y="${y + 30}" font-size="16" fill="#22201b">生の文字</text>`}));
  const {html} = await renderDiagram(d, {name: 't.svg', budget: 'cacheOnly', html: true});
  assert.match(html!, /<text[^>]*>生の文字<\/text>/);
});

const htmlOf = async (d: ReturnType<typeof diagram>) => (await renderDiagram(d, {name: 't.svg', budget: 'cacheOnly', html: true})).html!;

test('the parts keep the order of the layout: a raw() before a box is under it, as in the SVG', async () => {
  const d = diagram({theme: 'blue'});
  d.add(raw({h: 60, draw: ({x, y}: {x: number; y: number}) => `<rect x="${x}" y="${y}" width="40" height="40" fill="#22201b"/>`}));
  d.add(box({title: '上に乗る'}));
  const html = await htmlOf(d);
  assert.ok(html.indexOf('sd-raw') < html.indexOf('class="sd-b"'), 'the raw SVG comes first, the box over it');
});

test('connectors stay on top of every part', async () => {
  const d = diagram({theme: 'blue'});
  d.add(box({title: 'A', id: 'a'}));
  d.add(box({title: 'B', id: 'b'}));
  d.add(raw({h: 20, draw: () => '<g/>'}));
  d.connect('a', 'b', {label: '線ラベル'});
  const html = await htmlOf(d);
  assert.ok(html.indexOf('sd-raw') < html.indexOf('線ラベル'));
});

test('a table outside the spotlight is muted, as the SVG paints it', async () => {
  const mk = (spotlight?: string) => {
    const d = diagram({theme: 'blue', ...(spotlight ? {spotlight} : {})});
    d.add(box({title: '焦点', id: 'a'}));
    d.add(table([{label: '層', flex: 1}, {label: '役割', flex: 2}], [['画面', '入力']], {rowHeader: true}));
    return d;
  };
  const lit = (await htmlOf(mk())).split('class="sd-tbl"')[1];
  const dim = (await htmlOf(mk('a'))).split('class="sd-tbl"')[1];
  assert.match(lit!, new RegExp(PALETTE.text, 'i'));
  assert.doesNotMatch(dim!, new RegExp(`${PALETTE.text}|${PALETTE.border}`, 'i'), 'no text or border colour is left');
  assert.match(dim!, new RegExp(PALETTE.muted, 'i'));
});

test('the id comes from the content, not from how many figures were built before', async () => {
  const mk = (t: string) => { const d = diagram({theme: 'blue'}); d.add(box({title: t})); return d; };
  const a1 = await htmlOf(mk('甲'));
  await htmlOf(mk('乙'));
  const a2 = await htmlOf(mk('甲'));
  const b = await htmlOf(mk('乙'));
  const idOf = (h: string) => /<div id="(sd-[0-9a-f]{8})"/.exec(h)![1];
  assert.equal(idOf(a1), idOf(a2));
  assert.notEqual(idOf(a1), idOf(b));
  assert.ok(a1.includes(`#${idOf(a1)} .sd-b`), 'the CSS is scoped by that id');
});

test('an ideographic space or NBSP is a character, not white space to collapse', async () => {
  const d = diagram({theme: 'blue'});
  d.add(box({title: 'a\u3000\u3000b', body: 'c\u00a0\u00a0d'}));
  const html = await htmlOf(d);
  assert.ok(html.includes('a\u3000\u3000b'));
  assert.ok(html.includes('c\u00a0\u00a0d'));
});

// Both fonts are named in `fonts`, so the result does not depend on which sans font the machine has by default.
const dejavu = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', mathy = '/usr/share/fonts/truetype/dejavu/DejaVuMathTeXGyre.ttf';
let size = 16; // the font size of the caption, read from the HTML
const lineHeightWith = async (font: string) => {
  const d = diagram({theme: 'blue'});
  d.add(caption('Hello'));
  try {
    configureMeasure({measure: 'font', fonts: {sans: {regular: font, bold: font}}});
    const m = /font-size:(\d+)px;[^"]*line-height:(\d+)px/.exec(await htmlOf(d))!;
    size = Number(m[1]);
    return Number(m[2]);
  } finally { configureMeasure({}); }
};

test('the line box is the ascent + descent of the project\'s font', {skip: fs.existsSync(dejavu) ? false : 'needs DejaVu Sans'}, async () => {
  const got = await lineHeightWith(dejavu);
  const b = textBox('あ', 'sans', size, 400, {sans: {regular: dejavu, bold: dejavu}});
  assert.equal(got, b.ascent + b.descent);
});

test('a project font with other vertical metrics gives another line box', {skip: fs.existsSync(dejavu) && fs.existsSync(mathy) ? false : 'needs DejaVu Sans and DejaVu Math TeX Gyre'}, async () => {
  assert.notEqual(await lineHeightWith(mathy), await lineHeightWith(dejavu));
});

import {parsePath, shapesToCss} from '../lib/svg-to-css.ts';

test('parsePath flattens curves and arcs, reads relative and shorthand commands', () => {
  const [c] = parsePath('M0,0 C10,0 20,10 20,20')!;
  assert.ok(c!.pts.length > 4);
  assert.deepEqual(c!.pts[c!.pts.length - 1], {x: 20, y: 20});
  const [a] = parsePath('M10,0 A10,10 0 0 1 0,10')!;
  assert.ok(a!.pts.every(p => Math.abs(Math.hypot(p.x, p.y) - 10) < 0.01));
  assert.deepEqual(a!.pts[a!.pts.length - 1], {x: 0, y: 10});
  const [r] = parsePath('m1,1 h2 v2 h-2 z')!;
  assert.deepEqual(r!.pts, [{x: 1, y: 1}, {x: 3, y: 1}, {x: 3, y: 3}, {x: 1, y: 3}]);
  assert.equal(r!.closed, true);
  assert.equal(parsePath('M0,0 X1,1'), null);
});

test('shapes CSS can draw become boxes; what it cannot (a filter, a gradient) stays an inline SVG in order', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50" viewBox="0 0 100 50">'
    + '<rect x="4" y="4" width="40" height="20" rx="8" fill="#ffffff" stroke="#22201b" stroke-width="2.5"/>'
    + '<path d="M0,40 L50,40" fill="none" stroke="#22201b" stroke-width="2" stroke-dasharray="6,4"/>'
    + '<rect x="0" y="0" width="5" height="5" fill="url(#g)"/>'
    + '</svg>';
  const html = shapesToCss(svg, 'sd-ov');
  assert.match(html, /^<div class="sd-s"[^>]*box-shadow:inset 0 0 0 2.5px #22201b/);
  assert.equal((html.match(/clip-path:polygon/g) ?? []).length, 5, 'a 50px dashed line is 5 dashes');
  assert.match(html, /<svg class="sd-ov"[^>]*><rect[^>]*url\(#g\)/);
  assert.ok(html.indexOf('<svg') > html.lastIndexOf('clip-path'), 'paint order is kept');
});

test('a frame in HTML has the width of the SVG rect (the right edge snaps, not the width)', async () => {
  const d = diagram({theme: 'blue'}).add(row([box({title: '左'}), box({title: '中'}), box({title: '右'})]));
  const {svg, html} = await renderDiagram(d, {name: 't.svg', budget: 'cacheOnly', html: true});
  const svgW = [...svg.matchAll(/<rect x="[\d.]+" y="[\d.]+" width="([\d.]+)" height="[\d.]+" rx="8"/g)].map(m => Number(m[1]) + 2.5);
  const htmlW = [...html!.matchAll(/class="sd-b" style="left:[\d.-]+px;top:[\d.-]+px;width:([\d.]+)px/g)].map(m => Number(m[1]));
  assert.ok(svgW.length >= 3);
  assert.deepEqual(htmlW, svgW);
});

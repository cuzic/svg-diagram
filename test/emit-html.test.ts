import test from 'node:test';
import assert from 'node:assert/strict';
import {box, caption, diagram, closeMeasurer, renderDiagram, table, raw} from '../lib/dsl.ts';

process.env.SVG_DIAGRAM_STRICT_WIDTH = '1';
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

test('boxes and text are HTML elements; connectors stay in an inline SVG overlay', async () => {
  const {html} = await make();
  assert.match(html!, /<div class="sd-b" /);
  assert.match(html!, /class="sd-t"[^>]*>許可</);
  assert.match(html!, /<svg class="sd-ov" /);
  assert.match(html!, /marker-end="url\(#dsl-arrow\)"/);
  // the overlay brings no white background of its own, nor the SVG <style>/<metadata>
  assert.doesNotMatch(html!, /<svg[^>]*>[\s\S]*<rect x="0" y="0"/);
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
  assert.match(html!, /<svg class="sd-ov"/);
});

test('raw() stays the author\'s SVG, text included', async () => {
  const d = diagram({theme: 'blue'});
  d.add(raw({h: 60, draw: ({x, y}: {x: number; y: number}) => `<text x="${x + 10}" y="${y + 30}" font-size="16" fill="#22201b">生の文字</text>`}));
  const {html} = await renderDiagram(d, {name: 't.svg', budget: 'cacheOnly', html: true});
  assert.match(html!, /<text[^>]*>生の文字<\/text>/);
});

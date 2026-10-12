import test from 'node:test';
import assert from 'node:assert/strict';
import {box, caption, diagram, closeMeasurer, renderDiagram, row, connect} from '../lib/dsl.ts';

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

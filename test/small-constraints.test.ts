import test from 'node:test';
import assert from 'node:assert/strict';
import {banner, box, checkDiagram, closeMeasurer, diagram, group, renderDiagram, row, table} from '../lib/dsl.ts';

test.after(() => closeMeasurer());

const render = (d: ReturnType<typeof diagram>) => renderDiagram(d, {name: 'small.svg', budget: 'cacheOnly'});

test('group({frame: false}) draws no frame and no padding, and keeps its place in a row', async () => {
  const t = table([{label: 'a'}, {label: 'b'}], [['1', '2']]);
  const framed = await render(diagram({theme: 'blue'}).add(row([group([t], {tone: 'plain'}), box({title: 'x'})])));
  const bare = await render(diagram({theme: 'blue'}).add(row([group([t], {frame: false}), box({title: 'x'})])));
  assert.deepEqual(bare.verdict.problems, []);
  // the bare version has one outline fewer than the framed one: the group's frame
  const rects = (svg: string) => (svg.match(/<(path|rect)\b/g) ?? []).length;
  assert.ok(rects(bare.svg) < rects(framed.svg));
  assert.ok(bare.height < framed.height);
});

test('group({frame: false}) refuses a title, tone or dashed (nothing would show them)', () => {
  assert.throws(() => group([box({title: 'a'})], {frame: false, title: 'T'}), /frame: false.*no title/);
  assert.throws(() => group([box({title: 'a'})], {frame: false, tone: 'accent'}), /frame: false/);
});

test('table({cellH}) fixes every row height and centres the text', async () => {
  const d = diagram({theme: 'blue'}).add(table([{label: 'a'}, {label: 'b'}], [['1', '2'], ['3', '4']], {cellH: 48, id: 't'}));
  const {laidOut, verdict} = await checkDiagram(d);
  assert.deepEqual(verdict.problems, []);
  const t = laidOut.laidOut.find(b => b.type === 'table');
  assert.ok(t && t.type === 'table');
  assert.deepEqual(t.rows.map(r => r.h), [48, 48, 48]);
  for (const r of t.rows) for (const c of r.cells) assert.ok(Math.abs(c.top - (r.y + (48 - 14 * 1.5) / 2)) < 12); // inside its row
});

test('table({cellH}) throws when a cell needs more room, and leaves tables without cellH as they were', async () => {
  const long = '長い説明'.repeat(30);
  await assert.rejects(checkDiagram(diagram({theme: 'blue', width: 400}).add(table([{label: 'a'}], [[long]], {cellH: 40}))), /cellH 40 is too small/);
  await assert.rejects(checkDiagram(diagram({theme: 'blue'}).add(table([{label: 'a'}], [['x']], {cellH: 8}))), /cellH 8 is too small/);
  const {laidOut} = await checkDiagram(diagram({theme: 'blue'}).add(table([{label: 'a'}], [['x']])));
  const t = laidOut.laidOut.find(b => b.type === 'table');
  assert.ok(t && t.type === 'table');
  assert.equal(t.rows[1].cells[0].top, t.rows[1].y + 8); // top-aligned as before
});

test('stamp reserves a strip under the content and is drawn bottom-right of box, group and banner', async () => {
  const plain = await render(diagram({theme: 'blue'}).add(box({title: 'a', body: 'b'})));
  const stamped = await render(diagram({theme: 'blue'}).add(
    box({title: 'a', body: 'b', stamp: '架空の例'}),
    group([box({title: 'c'})], {title: 'g', stamp: 'イメージ'}),
    banner({headline: 'h', stamp: '要確認'}),
  ));
  assert.deepEqual(stamped.verdict.problems, []);
  assert.ok(stamped.height > plain.height);
  for (const s of ['架空の例', 'イメージ', '要確認']) assert.match(stamped.svg, new RegExp(`>${s}</text>`));
  assert.doesNotMatch(plain.svg, /架空の例/);
});

test('a stamp wider than its box is an error, not a silent overflow', async () => {
  await assert.rejects(render(diagram({theme: 'blue'}).add(row([box({title: 'a', stamp: '長い長い長い長い長い長いスタンプ'}), box({title: 'b'}), box({title: 'c'}), box({title: 'd'})], {cols: 12}))), /stamp .* is wider than its box/);
});

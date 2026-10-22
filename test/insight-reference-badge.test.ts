import test from 'node:test';
import assert from 'node:assert/strict';
import {closeMeasurer, diagram, renderDiagram, wf, wireframe} from '../lib/dsl.ts';

test.after(() => closeMeasurer());

// The numbered badge of the insight's 参考表示 chip sits on the chip's corner. It used to reach 5px into the chip, onto the last
// character (lint: "covered by a circle" with a font whose box is taller, such as Noto Sans JP): it is now outside the text.
test('the callout badge of the reference chip stays clear of the chip text', async () => {
  const d = diagram({theme: 'blue', title: 't'}).add(wireframe(wf.col([wf.insight({
    title: '在庫が発注点を下回っている', level: 'danger', text: '発注点は 30 個。', evidence: [{kind: '在庫数 24 個', at: '10/9 10:24'}],
    parts: {level: true, title: true, evidence: true, reference: true},
  })]), {frame: 'light', h: 'fit', title: 't', notes: [{title: 'a', text: 'a'}, {title: 'b', text: 'b'}, {title: 'c', text: 'c'}, {title: 'd', text: 'd'}]}));
  const {svg} = await renderDiagram(d, {name: 'i.svg', budget: 'cacheOnly'});
  const chip = /<text x="([\d.]+)" y="[\d.]+" text-anchor="middle"[^>]*>参考表示<\/text>/.exec(svg);
  assert.ok(chip, 'the chip is drawn');
  const textRight = Number(chip![1]) + 28; // 4 characters of 14px, centred
  const badges = [...svg.matchAll(/<g role="img" aria-label="注釈 \d+" data-badge="">\s*<circle cx="([\d.]+)" cy="([\d.]+)" r="11"/g)].map(m => Number(m[1]));
  const near = badges.filter(cx => Math.abs(cx - textRight) < 30);
  assert.ok(near.length >= 1, 'a badge sits on the chip');
  for (const cx of near) assert.ok(cx - 11 >= textRight - 3, `the badge (left edge ${cx - 11}) must not reach the text (right edge ${textRight})`);
});

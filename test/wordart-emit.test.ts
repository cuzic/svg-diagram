import test from 'node:test';
import './helpers/strict-width.ts'; // a text the layout did not register for measuring throws instead of measuring 0 wide
import assert from 'node:assert/strict';
import {banner, diagram, renderDiagram, wordart, closeMeasurer} from '../lib/dsl.ts';
import {geometryChecks} from '../lib/svg-lint.ts';
import {renderWordArt as renderWordArtForTest} from '../lib/emit-wordart.ts';
import {place} from './helpers/wordart.ts';

test.after(() => closeMeasurer());

test('emission: one readable text per run, the rest aria-hidden; a rim is the text\'s own stroke', () => {
  const svg = renderWordArtForTest(place('縁取り', {style: 'sticker', size: 40}), 'blue');
  assert.equal((svg.match(/<text /g) ?? []).length, 3, 'the shadow, the outer rim, and the text (whose own stroke is the inner halo)');
  assert.equal((svg.match(/aria-hidden="true"/g) ?? []).length, 2);
  assert.match(svg, /paint-order="stroke"/);
  const plain = renderWordArtForTest(place('太字', {style: 'bold', size: 40}), 'blue');
  assert.equal((plain.match(/<text /g) ?? []).length, 1);
  assert.doesNotMatch(plain, /stroke|aria-hidden/);
  const light = renderWordArtForTest(place('a&b<c>', {style: 'plain', size: 40}), 'blue');
  assert.ok(!light.includes('a&b'), 'escaped');
  const v = renderWordArtForTest(place('縦「A」12', {writing: 'vertical', size: 30}), 'blue');
  assert.match(v, /rotate\(90 /);
  assert.match(v, /<tspan x=/);
});

test('a built diagram: verifies, is well-formed, and passes the geometry lint (shadows are not labels)', async () => {
  const mk = () => diagram({theme: 'blue', title: 'x'}).add(
    banner({headline: '見出し'}),
    wordart('新製品', {style: 'sticker', size: 56}), wordart('SALE', {style: 'outline', size: 56}), wordart('縦書き 2026年', {writing: 'vertical', style: 'sticker', size: 32}),
  );
  const r = await renderDiagram(mk(), {name: 'w.svg', budget: 'cacheOnly'});
  assert.deepEqual(r.verdict.problems, []);
  assert.deepEqual(r.xml, []);
  const g = geometryChecks(r.svg)!;
  assert.deepEqual(g.contrast, [], 'a knocked-out letter reads by its rim');
  assert.deepEqual(g.textOverlap, []);
});

test('verifyDiagram rejects a letter that would not read', async () => {
  const r = await renderDiagram(diagram({theme: 'blue'}).add(wordart('見えない', {tone: 'bg', size: 40})), {name: 'w.svg', budget: 'cacheOnly'});
  assert.equal(r.verdict.ok, false);
  assert.match(r.verdict.problems.join('\n'), /wordart "見えない".*page/);
});

test('dark appearance recolours it with the rest', async () => {
  const r = await renderDiagram(diagram({theme: 'blue', appearance: 'dark'}).add(wordart('夜', {style: 'sticker', size: 40})), {name: 'w.svg', budget: 'cacheOnly'});
  assert.deepEqual(r.verdict.problems, []);
  assert.doesNotMatch(r.svg, /#22201b/);
});

test('emission: no <g transform> (every text carries its own); gradients and clips are defs; a mirror is aria-hidden and clipped', () => {
  const turned = renderWordArtForTest(place('回転', {style: 'sticker', size: 40, rotate: 15, flip: 'horizontal'}), 'blue');
  assert.ok(!/<g transform/.test(turned));
  assert.match(turned, /transform="rotate\(15 [\d.]+ [\d.]+\) translate\(/);
  const grad = renderWordArtForTest(place('色', {style: 'gradient', size: 40}), 'blue');
  assert.match(grad, /<defs><linearGradient id="(wa[^"]+)-g" gradientUnits="userSpaceOnUse"/);
  assert.match(grad, /fill="url\(#wa[^"]+-g\)"/);
  const refl = renderWordArtForTest(place('映', {style: 'reflect', size: 40}), 'blue');
  assert.match(refl, /<clipPath id="wa[^"]+-c"><rect /);
  assert.match(refl, /matrix\(1 0 0 -1 0 [\d.]+\)/);
  assert.match(refl, /aria-hidden="true"[^>]*clip-path="url\(#wa/);
  const arc = renderWordArtForTest(place('弧を描く文字', {size: 40, arc: 60}), 'blue');
  assert.match(arc, /<tspan x="[\d.]+" y="[\d.]+" rotate="-?[\d.]+">/);
  assert.match(renderWordArtForTest(place('mono', {style: 'plain', font: 'mono', size: 40}), 'blue'), /class="mono"/);
});

test('a diagram with every look builds clean, verifies, and the geometry lint finds nothing', async () => {
  const looks = ['sticker', 'outline', 'glow', 'emboss', '3d', 'gradient', 'reflect', 'shadow'] as const;
  const d = diagram({theme: 'blue', title: 'x'}).add(...looks.map(s => wordart('見出し', {style: s, size: 40})),
    wordart('弧を描く', {arc: 80, size: 36}), wordart('傾き', {rotate: -8, style: 'sticker', size: 40}), wordart('反転', {flip: 'horizontal', size: 40}), wordart('中抜き', {tone: 'none', outline: {tone: 'accent'}, size: 40}));
  const r = await renderDiagram(d, {name: 'w.svg', budget: 'cacheOnly'});
  assert.deepEqual(r.verdict.problems, []);
  assert.deepEqual(r.xml, []);
  const g = geometryChecks(r.svg)!;
  assert.deepEqual(g.textOverlap, []);
  assert.deepEqual(g.contrast, []);
});

test('HTML output keeps a wordart as SVG: nothing of it becomes a text div', async () => {
  const d = diagram({theme: 'blue', title: 'x'}).add(wordart('SALE', {style: 'outline', size: 56}), wordart('縦書き', {writing: 'vertical', size: 40}), wordart('回る', {rotate: 30, size: 40}), wordart('色', {style: 'gradient', size: 40}));
  const r = await renderDiagram(d, {name: 'w.svg', budget: 'cacheOnly', html: true});
  assert.ok(r.html);
  assert.equal((r.html!.match(/class="sd-t/g) ?? []).length, 0, 'no wordart text is turned into an HTML div');
  assert.match(r.html!, /paint-order="stroke"/);
  assert.match(r.html!, /<tspan x="[\d.]+" y="[\d.]+"/);
  assert.match(r.html!, /transform="rotate\(30 /);
  assert.match(r.html!, /fill="url\(#wa/);
});

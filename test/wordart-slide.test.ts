// WordArt on a deck slide: the slide outliner turns the text into glyph paths and must carry the stroke / paint-order the presets draw with.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {configureMeasure} from '../lib/measure.ts';
import {installResolveHook} from '../lib/resolve-hook.ts';
import {loadDeck} from '../lib/deck-load.ts';
import {renderDeck} from '../lib/present/render-deck.ts';
import type {Config} from '../lib/types/project.ts';
import {JA_FONTS} from './helpers/text-engine.ts';

const cfg: Config = {measure: 'font', fonts: JA_FONTS};
installResolveHook();
configureMeasure(cfg);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wordart-slide-'));
test.after(() => fs.rmSync(dir, {recursive: true, force: true}));
const PRESETS = ['plain', 'bold', 'outline', 'shadow', 'sticker', 'glow', 'emboss', '3d', 'gradient', 'reflect'];

async function slideOf(style: string) {
  fs.writeFileSync(path.join(dir, `${style}.ts`), `import {diagram, wordart} from 'svg-diagram';\nexport default () => diagram({theme: 'blue', title: 'w'}).add(wordart('見出しサンプル', {style: '${style}', size: 64}));\n`);
  const f = path.join(dir, 'deck.json');
  fs.writeFileSync(f, JSON.stringify({slides: [{figure: `${style}.ts`}]}));
  const got = loadDeck(f);
  assert.ok(got.ok);
  return renderDeck(got.loaded, cfg);
}

for (const style of PRESETS) {
  test(`wordart '${style}' can be a slide's figure`, async () => {
    const r = await slideOf(style);
    assert.deepEqual(r.errors, []);
    assert.ok(r.slides[0]?.svg);
  });
}

test('an outlined sticker / outline keeps its stroke on the glyphs (paint-order as a stroke pass), with the width in the glyphs\' own units', async () => {
  for (const style of ['sticker', 'outline']) {
    const svg = (await slideOf(style)).slides[0]?.svg as string;
    const groups = [...svg.matchAll(/<g\b[^>]*\bstroke="(?!none)[^>]*>(?=<use)/g)].map(m => m[0]);
    assert.ok(groups.length > 0, `${style}: the glyphs are stroked`);
    for (const g of groups) {
      assert.match(g, /stroke-linejoin="round"/, `${style}: linejoin kept`);
      // 64px letters from a 1000- or 2048-unit font: the width on the page is a few px, so in font units it is far more than that
      assert.ok(Number(/stroke-width="([\d.]+)"/.exec(g)?.[1]) > 20, `${style}: stroke-width is divided by the glyph scale (${g})`);
    }
    assert.ok(groups.some(g => /fill="none"/.test(g)), `${style}: a stroke drawn first is its own pass`);
    assert.doesNotMatch(svg, /<text\b/);
  }
});

test('the reflection keeps its clip-path and the slide stays valid', async () => {
  const svg = (await slideOf('reflect')).slides[0]?.svg as string;
  assert.match(svg, /<g\b[^>]*clip-path="url\(#[^)]+\)"[^>]*role="img"/);
});

test('spacing and arc stay slide errors, and the message says so', async () => {
  fs.writeFileSync(path.join(dir, 'spaced.ts'), `import {diagram, wordart} from 'svg-diagram';\nexport default () => diagram({theme: 'blue', title: 'w'}).add(wordart('見出し', {style: 'sticker', spacing: 4, size: 64}));\n`);
  fs.writeFileSync(path.join(dir, 'deck2.json'), JSON.stringify({slides: [{figure: 'spaced.ts'}]}));
  const got = loadDeck(path.join(dir, 'deck2.json'));
  assert.ok(got.ok);
  const r = await renderDeck(got.loaded, cfg);
  assert.match(r.errors.join('\n'), /letter-spacing cannot be outlined.*all WordArt presets work on slides, but not `spacing`/);
});

test('arc stays a slide error, and the message says so', async () => {
  fs.writeFileSync(path.join(dir, 'arched.ts'), `import {diagram, wordart} from 'svg-diagram';\nexport default () => diagram({theme: 'blue', title: 'w'}).add(wordart('見出し', {style: 'sticker', arc: 60, size: 64}));\n`);
  fs.writeFileSync(path.join(dir, 'deck3.json'), JSON.stringify({slides: [{figure: 'arched.ts'}]}));
  const got = loadDeck(path.join(dir, 'deck3.json'));
  assert.ok(got.ok);
  const r = await renderDeck(got.loaded, cfg);
  assert.match(r.errors.join('\n'), /rotate cannot be outlined.*all WordArt presets work on slides, but not `arc`/);
});

test('a sticker draws every letter\'s stroke before any fill', async () => {
  const svg = (await slideOf('sticker')).slides[0]?.svg as string;
  const lastStroke = svg.lastIndexOf('fill="none"><use');
  assert.ok(lastStroke > 0, 'a stroke pass exists');
  // after the last stroke group comes the fill pass: bare glyphs
  assert.match(svg.slice(lastStroke), /<\/g><use/);
  assert.doesNotMatch(svg, /paint-order/);
});

test('a gradient wordart is drawn in the figure\'s own space, so the gradient runs across the letters', async () => {
  const svg = (await slideOf('gradient')).slides[0]?.svg as string;
  const grad = /<linearGradient[^>]*\by1="([\d.-]+)"[^>]*\by2="([\d.-]+)"/.exec(svg);
  assert.ok(grad, 'the gradient is kept');
  const [y1, y2] = [Number(grad[1]), Number(grad[2])];
  const group = /<g[^>]*fill="url\(#[^)]+\)"[^>]*role="img"[^>]*>([\s\S]*?)<\/g>/.exec(svg);
  assert.ok(group, 'the letters are filled by the gradient');
  assert.doesNotMatch(group[1] as string, /<use\b/, 'no glyph is scaled into font units');
  const ys = [...(group[1] as string).matchAll(/d="([^"]+)"/g)].flatMap(m => [...(m[1] as string).matchAll(/,(-?[\d.]+)/g)].map(p => Number(p[1])));
  assert.ok(ys.length > 0);
  // the letters lie inside the gradient's span, so the colours change along them
  assert.ok(Math.min(...ys) >= y1 - 12 && Math.max(...ys) <= y2 + 12, `${Math.min(...ys)}..${Math.max(...ys)} within ${y1}..${y2}`);
  assert.ok(Math.max(...ys) - Math.min(...ys) > (y2 - y1) * 0.4, 'and cover a good part of it');
});

test('the outline of gradient letters is in figure px, not divided by the glyph scale', async () => {
  fs.writeFileSync(path.join(dir, 'gsticker.ts'), `import {diagram, wordart} from 'svg-diagram';\nexport default () => diagram({theme: 'blue', title: 'w'}).add(wordart('見出し', {style: 'sticker', gradient: {from: 'accent', to: 'text'}, size: 64}));\n`);
  fs.writeFileSync(path.join(dir, 'deck4.json'), JSON.stringify({slides: [{figure: 'gsticker.ts'}]}));
  const got = loadDeck(path.join(dir, 'deck4.json'));
  assert.ok(got.ok);
  const r = await renderDeck(got.loaded, cfg);
  assert.deepEqual(r.errors, []);
  const widths = [...(r.slides[0]?.svg ?? '').matchAll(/<g\b[^>]*\bstroke="(?!none)[^>]*\bstroke-width="([\d.]+)"[^>]*fill="none"><path/g)].map(m => Number(m[1]));
  assert.ok(widths.length > 0, 'the letters are outlined');
  assert.ok(widths.every(w => w > 0 && w < 20), `stroke widths in px: ${widths}`);
});

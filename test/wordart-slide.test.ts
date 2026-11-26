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

test('an outlined sticker / outline keeps its stroke and paint-order on the glyphs, with the width in the glyphs\' own units', async () => {
  for (const style of ['sticker', 'outline']) {
    const svg = (await slideOf(style)).slides[0]?.svg as string;
    const groups = [...svg.matchAll(/<g\b[^>]*\bstroke="(?!none)[^>]*>(?=<use)/g)].map(m => m[0]);
    assert.ok(groups.length > 0, `${style}: the glyphs are stroked`);
    for (const g of groups) {
      assert.match(g, /stroke-linejoin="round"/, `${style}: linejoin kept`);
      // 64px letters from a 1000- or 2048-unit font: the width on the page is a few px, so in font units it is far more than that
      assert.ok(Number(/stroke-width="([\d.]+)"/.exec(g)?.[1]) > 20, `${style}: stroke-width is divided by the glyph scale (${g})`);
    }
    assert.ok(groups.some(g => /paint-order="stroke"/.test(g)), `${style}: paint-order kept on the text layer`);
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

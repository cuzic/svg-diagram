// ADR 0056 D2: a deck slide as one SVG with every text outlined. The outlines come from the same font files, at the same widths, as the
// measuring (lib/font-metrics.ts); the slide sits where the .pptx puts it (lib/deck-layout.ts); an `auto` figure is drawn light and a dark
// one on its own panel; what comes out passes the allowlist the Worker applies (lib/present/svg-allow.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {measureWithFonts, outlineFontFromFiles, textBox} from '../lib/font-metrics.ts';
import {planDeckLayout, SLIDE_W, type TextWidth} from '../lib/deck-layout.ts';
import {placedFigure, slideSvg, slideText} from '../lib/present/slide-svg.ts';
import {checkSlideSvg} from '../lib/present/svg-allow.ts';
import type {FontFamily} from '../lib/types/core.ts';
import {JA_FONTS} from './helpers/text-engine.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const font = outlineFontFromFiles(JA_FONTS);
const box = (t: string, family: FontFamily, size: number, weight: number) => textBox(t, family, size, weight, JA_FONTS);
const width: TextWidth = (t, size, bold) => box(t, 'sans', size, bold ? 700 : 400).w;

test('the outlines advance exactly as far as the text was measured, a fallback font included', () => {
  const texts: {text: string; font: FontFamily; weight: number}[] = [
    {text: '4つの図は、目の向きと渡すものが違う', font: 'sans', weight: 700},
    {text: 'Value chain: 時間とお金の使い方 (2026)', font: 'sans', weight: 400},
    {text: 'const x = 1; // 日本語のコメント', font: 'mono', weight: 400},
    {text: 'AVATAR Wave — “quoted” fi fl', font: 'sans', weight: 700},
  ];
  const req = new Map(texts.map((t, i) => [String(i), {text: t.text, size: 19, weight: t.weight, font: t.font}]));
  const measured = measureWithFonts(req, JA_FONTS);
  texts.forEach((t, i) => {
    const shaped = font.shape(t.text, t.font, t.weight);
    const advance = shaped.glyphs.reduce((n, g) => n + g.xAdvance, 0) / shaped.upem * 19;
    assert.ok(Math.abs(advance - (measured.get(String(i))?.w ?? NaN)) < 0.01, `${t.text}: outlined ${advance}, measured ${measured.get(String(i))?.w}`);
  });
});

test('a fallback glyph is drawn from its own font, scaled to the primary font\'s units', () => {
  const shaped = font.shape('x日', 'mono', 400);
  assert.equal(shaped.glyphs.length, 2);
  const [latin, ja] = shaped.glyphs;
  assert.ok(latin && ja && Math.floor(latin.id / 0x10000) !== Math.floor(ja.id / 0x10000), 'the two glyphs come from two fonts');
  assert.match(font.path(ja?.id ?? 0, 'mono', 400), /^M/);
});

test('a slide: white page, text outlined (no <text> left), the figure nested where the layout puts it, and it passes the allowlist', () => {
  const slide = {title: '4つの図は、目の向きと渡すものが違う', lead: '事業者の目とお客さんの目の両方で現状を見る。', callouts: [{label: '足す一文：', text: '根っこを1つに絞る'}], source: '出典: 試験'};
  const figure = fs.readFileSync(path.join(ROOT, 'examples/out/bars.svg'), 'utf8');
  const fw = Number(/width="([\d.]+)"/.exec(figure)?.[1]), fh = Number(/height="([\d.]+)"/.exec(figure)?.[1]);
  const layout = planDeckLayout(slide, {w: fw, h: fh}, width);
  const out = slideSvg(layout, {svg: figure}, font, box);
  assert.deepEqual([out.missing, out.unsupported, out.liveEmoji], [[], [], []]);
  assert.ok(out.svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" width="${SLIDE_W}" height="720"`));
  assert.doesNotMatch(out.svg, /<text\b/);
  assert.doesNotMatch(out.svg, /<metadata\b/);
  const place = layout.figure;
  assert.ok(place);
  assert.ok(out.svg.includes(`x="${Math.round(place.x * 100) / 100}" y="${Math.round(place.y * 100) / 100}"`), 'the nested figure at the layout\'s place');
  assert.deepEqual(checkSlideSvg(out.svg), {ok: true});
  assert.equal(slideText(slide, 'Bars'), '4つの図は、目の向きと渡すものが違う\n事業者の目とお客さんの目の両方で現状を見る。\nBars\n足す一文：根っこを1つに絞る\n出典: 試験');
});

test('an auto figure loses its dark-mode block; a dark figure gets its page colour as a panel behind it', () => {
  const auto = '<svg data-appearance="auto" xmlns="http://www.w3.org/2000/svg" width="100" height="50" viewBox="0 0 100 50"><style>\n    text { fill: #000 }\n    @media (prefers-color-scheme: dark) {\n      svg[data-appearance="auto"] [fill="#ffffff" i] { fill: #000000 }\n    }</style><rect width="100" height="50" fill="#ffffff"/></svg>';
  const placed = placedFigure(auto, {x: 10, y: 20, w: 200, h: 100});
  assert.doesNotMatch(placed, /prefers-color-scheme/);
  assert.match(placed, /^<svg viewBox="0 0 100 50" x="10" y="20" width="200" height="100">/);
  const dark = fs.readFileSync(path.join(ROOT, 'examples/out/dark-theme.svg'), 'utf8');
  assert.match(placedFigure(dark, {x: 10, y: 20, w: 200, h: 100}), /^<rect x="10" y="20" width="200" height="100" fill="#0b1220"\/><svg /);
});

test('an emoji no font outlines stays live text, and is reported', () => {
  const layout = planDeckLayout({title: '乾杯 🎉 です'}, undefined, width);
  const out = slideSvg(layout, undefined, font, box);
  assert.deepEqual(out.missing, []);
  if (out.liveEmoji.length) assert.deepEqual(out.liveEmoji, ['🎉']);
  assert.deepEqual(checkSlideSvg(out.svg), {ok: true});
});

test('deckTexts lists every measured text at its size and weight; minTextPt reads the smallest run of a slide\'s XML', async () => {
  const {deckTexts} = await import('../lib/deck-layout.ts');
  const {minTextPt} = await import('../lib/pptx/deck.ts');
  assert.deepEqual(deckTexts({title: 'T', lead: 'L', source: 'S', callouts: [{label: 'a：', text: 'b'}]}), [
    {text: 'T', size: 37, bold: true}, {text: 'L', size: 19, bold: false}, {text: 'S', size: 13, bold: false}, {text: 'a：b', size: 16, bold: true},
  ]);
  assert.equal(minTextPt('<a:rPr lang="ja-JP" sz="1400"/><a:rPr sz="950" b="1"/>'), 9.5);
  assert.equal(minTextPt('<p:sp/>'), null);
});

test('a deck holds up to MAX_SLIDES (300) slides; one more is refused with its place', async () => {
  const {MAX_SLIDES, validateDeck} = await import('../lib/deck-spec.ts');
  assert.equal(MAX_SLIDES, 300);
  const deck = (n: number) => ({slides: Array.from({length: n}, (_, i) => ({title: `スライド ${i + 1}`}))});
  assert.deepEqual(validateDeck(deck(300)), []);
  assert.ok(validateDeck(deck(301)).some(x => x.path === 'slides'));
});

test('before sending, a deck over the Worker\'s size says the size is what is over, not the number of slides', async () => {
  const {overLimits} = await import('../lib/present/publish.ts');
  const slide = (n: number) => ({svg: 'x'.repeat(n), hash: String(n), text: '', title: '', notes: ''});
  const over = overLimits(Array.from({length: 300}, (_, i) => slide(100_000 + i)), {maxSlides: 300, maxSlideBytes: 4 * 1048576, maxDeckBytes: 16 * 1048576});
  assert.equal(over.length, 1);
  assert.match(over[0] ?? '', /^the slides' SVGs come to 28\.7 MiB together, over the Worker's 16\.0 MiB \(MAX_DECK_BYTES\) — the number of slides \(300\) is within MAX_SLIDES \(300\)/);
});

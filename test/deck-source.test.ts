// A slide's `source` (footnote) takes up to 800 characters: it wraps at the same small size, the figure's room shrinks by its lines, and a
// source that wraps past SOURCE_MAX_LINES is an error that says where and how to fix it. The text in the examples is made up.
import test from 'node:test';
import assert from 'node:assert/strict';
import {closeMeasurer} from '../lib/dsl.ts';
import {SOURCE_MAX_CHARS, SOURCE_MAX_LINES, STYLE, planDeckLayout, type TextBlock, type TextWidth} from '../lib/deck-layout.ts';
import {deckSchema, validateDeck} from '../lib/deck-spec.ts';
import {loadDeck} from '../lib/deck-load.ts';
import {renderDeck} from '../lib/present/render-deck.ts';
import {renderDeckPptxEdge} from '../lib/pptx-deck-edge.ts';
import {planDeckSlide, slideIssues} from '../lib/pptx/deck.ts';
import {fontsOf} from '../lib/pptx/slide.ts';
import {partCatalog} from '../lib/spec.ts';
import {JA_FONTS, realEngine} from './helpers/text-engine.ts';
import {unzipEntry} from './helpers/pptx/unzip.ts';
import type {Config} from '../lib/types/project.ts';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test.after(() => closeMeasurer());
const fixed: TextWidth = (t, size) => [...t].length * size;
const PER_LINE = Math.floor(1168 / STYLE.source.size);
const source = (n: number) => 'あ'.repeat(n);
const sourceBlock = (l: ReturnType<typeof planDeckLayout>) => l.bottom.flat().find((b): b is TextBlock => b.kind === 'text' && b.name === 'source');
const at = (slide: object) => validateDeck({slides: [slide]}).map(i => `${i.path}: ${i.message}`);

test('source: 800 characters are accepted and 801 are refused where they are written', () => {
  assert.equal(SOURCE_MAX_CHARS, 800);
  assert.deepEqual(at({title: 't', source: source(800)}), []);
  assert.match(at({title: 't', source: source(801)}).join('\n'), /slides\[0\]\.source/);
  const prop = (deckSchema as {properties: {slides: {items: {properties: {source: {maxLength: number}}}}}}).properties.slides.items.properties.source;
  assert.equal(prop.maxLength, 800);
});

test('planDeckLayout: a long source wraps at the footnote size and the figure area shrinks by the extra lines', () => {
  const figure = {w: 400, h: 100};
  const one = planDeckLayout({title: 't', source: source(PER_LINE)}, figure, fixed);
  const five = planDeckLayout({title: 't', source: source(PER_LINE * 4 + 1)}, figure, fixed);
  assert.equal(sourceBlock(one)?.lines.length, 1);
  assert.equal(sourceBlock(five)?.lines.length, 5);
  assert.equal(sourceBlock(five)?.size, STYLE.source.size, 'the footnote size does not change');
  assert.equal(one.room.h - five.room.h, 4 * Math.round(STYLE.source.size * 1.3), 'each extra line takes its pitch from the room');
  assert.equal(five.noRoom, false);
});

test('planDeckLayout: more than SOURCE_MAX_LINES lines is an error that says the characters, the lines and the fix', () => {
  const ok = planDeckLayout({title: 't', source: source(PER_LINE * SOURCE_MAX_LINES)}, {w: 100, h: 50}, fixed);
  assert.equal(ok.sourceError, null);
  assert.equal(ok.noRoom, false);
  const over = planDeckLayout({title: 't', source: source(PER_LINE * SOURCE_MAX_LINES + 1)}, {w: 100, h: 50}, fixed);
  assert.equal(over.noRoom, true);
  assert.match(over.sourceError ?? '', new RegExp(`the source \\(${PER_LINE * SOURCE_MAX_LINES + 1} characters\\) wraps to ${SOURCE_MAX_LINES + 1} lines .*shorten it.*notes`));
});

const cfg: Config = {measure: 'font', fonts: JA_FONTS};
const figure = {version: 1, title: 'f', parts: [partCatalog().find(p => p.type === 'bars')?.example]};

test('renderDeck (serve / site): an 800-character full-width source draws, and shrinks the figure against a short one', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-source-'));
  const run = async (src: string) => {
    const file = path.join(dir, 'deck.json');
    fs.writeFileSync(file, JSON.stringify({slides: [{title: 't', figure, source: src}]}));
    const r = loadDeck(file);
    assert.ok(r.ok);
    return renderDeck(r.loaded, cfg);
  };
  const short = await run('出典の例。'), long = await run('出典の例。'.repeat(160));
  assert.deepEqual(long.errors, []);
  assert.ok(short.slides[0] && long.slides[0]);
  assert.notEqual(short.slides[0].svg, long.slides[0].svg);
  assert.ok(long.slides[0].text.endsWith('出典の例。'.repeat(160)), 'the whole source is on the slide');
});

test('pptx: the footnote text box grows with its lines and the issue is reported at slides[i].source', async () => {
  const lines = (n: number) => {
    const p = planDeckSlide({title: 't', source: source(PER_LINE * n)}, fontsOf(), fixed);
    const m = /name="source"[\s\S]*?<a:ext cx="\d+" cy="(\d+)"/.exec(p.xml);
    return Number(m?.[1]);
  };
  assert.ok(lines(4) > lines(1) && lines(4) === lines(1) * 4, `${lines(1)} ${lines(4)}`);
  const over = planDeckSlide({title: 't', source: source(PER_LINE * (SOURCE_MAX_LINES + 1))}, fontsOf(), fixed);
  assert.equal(over.noRoom, true);
  const issues = slideIssues(over, 2, false);
  assert.equal(issues.errors[0]?.path, 'slides[2].source');
  assert.match(issues.errors[0]?.message ?? '', /wraps to/);
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const r = await renderDeckPptxEdge({slides: [{title: 't', figure, source: '出典の例。'.repeat(150)}]}, realEngine(), {rasterize: () => PNG});
  assert.deepEqual(r.issues, []);
  assert.match(unzipEntry(Buffer.from(r.pptx as Uint8Array), 'ppt/slides/slide1.xml').toString(), /出典の例。/);
});

test('a long source makes the figure smaller, and a dense figure then gets the small-text warning', async () => {
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const dense = {version: 1, title: 'd', parts: [{type: 'bars', dir: 'h', unit: '点', data: Array.from({length: 14}, (_, i) => ({label: `項目${i + 1}`, value: 20 + i * 5}))}]};
  const run = async (src: string) => {
    const r = await renderDeckPptxEdge({slides: [{title: '見出し', lead: 'リード', figure: dense, source: src}]}, realEngine(), {rasterize: () => PNG});
    return {scale: r.slides[0]?.scale ?? 0, warnings: r.warnings.map(w => w.message)};
  };
  const short = await run('出典の例。'), long = await run('出典の例。'.repeat(160));
  assert.ok(long.scale < short.scale, `${long.scale} < ${short.scale}`);
  assert.ok(long.warnings.some(w => /smallest text/.test(w)), 'the existing small-text warning fires');
});

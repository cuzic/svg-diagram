// ADR 0066: a cover slide (`layout: "cover"`). Its fields and the mistakes it refuses (validateDeck, loadDeck), its plan (lib/deck-layout.ts:
// centred, the title stepped down from 56 to 48 to 40 px, no room said once), the .pptx (centred, not wrapped again) and the slide SVG
// (each line in the middle of its measured width). The names in the examples are made up.
import {createHash} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {COVER, deckTexts, figureRooms, planDeckLayout, roomMessage, SLIDE_W, type TextBlock, type TextWidth} from '../lib/deck-layout.ts';
import {deckSchema, notOnCover, validateDeck} from '../lib/deck-spec.ts';
import {loadDeck} from '../lib/deck-load.ts';
import {outlineFontFromFiles, textBox} from '../lib/font-metrics.ts';
import {renderDeckPptxEdge} from '../lib/pptx-deck-edge.ts';
import {planDeckSlide, slideIssues} from '../lib/pptx/deck.ts';
import {fontsOf} from '../lib/pptx/slide.ts';
import {slideSvg, slideText} from '../lib/present/slide-svg.ts';
import {checkSlideSvg} from '../lib/present/svg-allow.ts';
import type {FontFamily} from '../lib/types/core.ts';
import {JA_FONTS, realEngine} from './helpers/text-engine.ts';
import {unzipEntry} from './helpers/pptx/unzip.ts';
import {closeMeasurer} from '../lib/dsl.ts';

test.after(() => closeMeasurer());
const ROOT = path.resolve(import.meta.dirname, '..');
const COVER_SLIDE = {layout: 'cover' as const, event: '第3回 図の描き方 勉強会', title: '図で伝える、要件の話', lead: '言葉だけでは伝わらないことを、図にして渡す。', date: '2026年12月4日', presenter: '山田 花子'};
const fixed: TextWidth = (t, size) => [...t].length * size;
const text = (blocks: readonly unknown[], name: string) => blocks.find((b): b is TextBlock => (b as TextBlock).kind === 'text' && (b as TextBlock).name === name);

test('validateDeck: a cover takes title, lead, event, date, presenter, source and notes; what it does not draw is a mistake where it is written', () => {
  const at = (deck: unknown) => validateDeck(deck).map(i => `${i.path}: ${i.message}`);
  assert.deepEqual(at({slides: [{...COVER_SLIDE, source: '© 2026 例', notes: '一\n二'}]}), []);
  assert.deepEqual(at({fit: 'width', slides: [COVER_SLIDE, {title: 'ふつう'}]}), [], 'the deck\'s fit is for the figure slides');
  assert.deepEqual(at({slides: [{layout: 'cover', lead: '副題だけ'}]}), ['slides[0].title: a cover needs a title'], 'said once, not with "needs a title, a figure or columns"');
  const f = {version: 1, title: 'f', parts: [{type: 'flowchart', nodes: [{id: 'a', label: 'A'}]}]};
  assert.deepEqual(validateDeck({slides: [{...COVER_SLIDE, figure: f, columns: [{text: 'a'}, {text: 'b'}], columnScale: 'same', fit: 'fill', callouts: [{text: 'x'}]}]}).map(i => i.path),
    ['slides[0].figure', 'slides[0].columns', 'slides[0].columnScale', 'slides[0].fit', 'slides[0].callouts']);
  assert.equal(validateDeck({slides: [{...COVER_SLIDE, figure: f}]})[0]?.message, notOnCover('figure'));
  assert.match(notOnCover('figure'), /not drawn on a cover/);
  assert.deepEqual(validateDeck({slides: [{title: 'ふつう', event: 'e', date: 'd', presenter: 'p'}]}).map(i => `${i.path}: ${i.message}`), [
    'slides[0].event: is drawn only on a cover: add "layout": "cover" to the slide, or take it out',
    'slides[0].date: is drawn only on a cover: add "layout": "cover" to the slide, or take it out',
    'slides[0].presenter: is drawn only on a cover: add "layout": "cover" to the slide, or take it out',
  ]);
  assert.deepEqual(validateDeck({slides: [{...COVER_SLIDE, layout: 'section'}]}).map(i => i.path), ['slides[0].layout']);
  assert.deepEqual(validateDeck({slides: [{...COVER_SLIDE, date: '1'.repeat(61)}]}).map(i => i.path), ['slides[0].date']);
  const slide = deckSchema.properties?.['slides']?.items?.properties ?? {};
  for (const k of ['layout', 'event', 'date', 'presenter']) assert.ok(slide[k]?.description, `${k} is described`);
  for (const k of ['figure', 'columns', 'columnScale', 'fit', 'callouts']) assert.match(slide[k]?.description ?? '', /Not on a cover/, k);
});

test('loadDeck: a cover\'s figure, a path or not, is refused once at its figure (not read first), and gets no stand-in title', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-cover-'));
  try {
    const file = path.join(dir, 'deck.json'), ts = path.join(ROOT, 'examples/bars.ts'), at = 'slides[0].figure: ' + notOnCover('figure');
    const errors = (slide: object) => { fs.writeFileSync(file, JSON.stringify({slides: [slide]})); const got = loadDeck(file); return got.ok ? [] : got.errors; };
    assert.deepEqual(errors({layout: 'cover', figure: ts}), ['slides[0].title: a cover needs a title', at]);
    assert.deepEqual(errors({layout: 'cover', title: '題', figure: ts}), [at]);
    assert.deepEqual(errors({layout: 'cover', title: '題', figure: 'missing.ts'}), [at], 'a broken path is not said before the cover');
    assert.deepEqual(errors({layout: 'cover', title: '題', figure: 'figure.png'}), [at]);
    assert.deepEqual(errors({layout: 'cover', title: '題', columns: [{figure: ts}, {text: 'b'}]}), ['slides[0].columns: ' + notOnCover('columns')]);
    assert.deepEqual(errors({title: '題', figure: 'missing.ts'}), ['slides[0].figure: missing.ts does not exist'], 'an ordinary slide reads its path as before');
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

test('planDeckLayout: a cover is its fields centred in a column of 1040 px, stacked in the middle of the slide, the source at the bottom left', () => {
  const l = planDeckLayout({...COVER_SLIDE, source: '© 2026 例'}, undefined, fixed);
  assert.deepEqual(l.top.map(b => b.name), ['event', 'title', 'lead', 'cover rule', 'date', 'presenter']);
  for (const b of l.top) if (b.kind === 'text') assert.deepEqual([b.x, b.width, b.align], [(SLIDE_W - COVER.width) / 2, COVER.width, 'center'], b.name);
  const rule = l.top[3];
  assert.ok(rule?.kind === 'rect' && rule.x === (SLIDE_W - COVER.rule.w) / 2 && rule.fill === COVER.rule.fill);
  assert.deepEqual([text(l.top, 'title')?.size, text(l.top, 'title')?.pitch], [56, 67]);
  assert.equal(text(l.bottom.flat(), 'source')?.align, undefined, 'the source is drawn as on any slide');
  assert.deepEqual([l.figure, l.columns, l.noRoom], [null, [], false]);
  // in the middle: as much room above the event as under the presenter, down to the source
  const first = l.top[0], last = text(l.top, 'presenter'), source = text(l.bottom.flat(), 'source');
  assert.ok(first && last && source);
  const below = source.y - 10 - (last.y + last.lines.length * last.pitch);
  assert.ok(Math.abs((first.y - 32) - below) < 1, `${first.y - 32} above, ${below} below`);
  // without a date or a presenter there is no rule
  assert.deepEqual(planDeckLayout({layout: 'cover', title: '題'}, undefined, fixed).top.map(b => b.name), ['title']);
  // figureRooms (called for every slide) leaves a cover as it is
  assert.doesNotThrow(() => figureRooms(COVER_SLIDE, fixed));
});

test('a long title steps down to 48 px, then 40 px; a cover that does not fit is no room, said as a cover', () => {
  const size = (title: string, lead?: string) => text(planDeckLayout({layout: 'cover', title, ...(lead ? {lead} : {})}, undefined, fixed).top, 'title')?.size;
  assert.equal(size('あ'.repeat(30)), 56, '30 × 56 = 1680 px: two lines');
  assert.equal(size('あ'.repeat(40)), 48, 'three lines at 56 px (18 a line), two at 48 px (21 a line)');
  assert.equal(size('あ'.repeat(60)), 40, 'three lines at 48 px too');
  // 15 lines of lead (510 px): 2 × 67 + 20 + 510 = 664 px is over the 660 px of room at 56 px; 2 × 58 + 20 + 510 = 646 fits at 48
  assert.equal(size('あ'.repeat(30), 'い'.repeat(590)), 48, 'a long lead takes the title down so that the whole fits');
  const over = planDeckLayout({layout: 'cover', title: 'あ'.repeat(120), lead: 'い'.repeat(300), event: 'う'.repeat(80), presenter: 'え'.repeat(120), date: '2026年', source: 'お'.repeat(300)}, undefined, fixed);
  assert.equal(over.noRoom, true);
  const p = planDeckSlide({layout: 'cover', title: 'あ'.repeat(120), lead: 'い'.repeat(300), event: 'う'.repeat(80), presenter: 'え'.repeat(120), source: 'お'.repeat(300)}, fontsOf(), fixed);
  assert.deepEqual(slideIssues(p, 0, false).errors, [{path: 'slides[0]', message: roomMessage(false, true)}]);
  assert.match(roomMessage(false, true), /cover/);
  // a run with no place to break stays one line: wider than the column, it is no room too (it would leave the slide)
  const url = planDeckLayout({layout: 'cover', title: '題', presenter: 'https://example.com/' + 'a'.repeat(95)}, undefined, (t, size) => t.length * size * 0.6);
  assert.equal(url.noRoom, true);
});

test('a slide that is not a cover is planned as before: the .pptx XML of ordinary slides is the same bytes as on main (960d16b8), except the source box is wrap="none" (PR #491)', () => {
  const w: TextWidth = (t, size, bold) => [...t].length * size * (bold ? 1.05 : 1);
  const xml = [planDeckSlide({title: '見出しの文', lead: 'リードの文。'.repeat(8), callouts: [{label: '足す一文：', text: '強調の文'}], source: '出典: 例', notes: 'n'}, fontsOf(), w).xml,
    planDeckSlide({title: 'T', columns: [{caption: '左', text: '・一\n・二'}, {text: '右の文'}]}, fontsOf(), w).xml].join('\n');
  assert.equal(createHash('sha256').update(xml).digest('hex'), '4e134f94f70392157ccac6645f69654db90878b80362f298528201ac7896797d');
});

test('deckTexts lists every text a cover measures, at every size and weight it is measured at', () => {
  const asked = new Set<string>();
  const w: TextWidth = (t, size, bold) => { asked.add(`${size}|${bold}|${t}`); return [...t].length * size; };
  for (const title of ['短い題', 'あ'.repeat(40), 'あ'.repeat(60)]) {
    const s = {...COVER_SLIDE, title, source: '© 2026 例'};
    asked.clear();
    planDeckLayout(s, undefined, w);
    const listed = deckTexts(s);
    for (const a of asked) {
      const [size, bold, t] = a.split('|');
      assert.ok(listed.some(x => String(x.size) === size && String(x.bold) === bold && x.text.includes(t ?? '')), `${a} is measured but not listed`);
    }
  }
});

test('the .pptx: each cover text is centred and not wrapped again; a slide that is not a cover keeps its text boxes as they were', async () => {
  const p = planDeckSlide(COVER_SLIDE, fontsOf(), fixed);
  assert.deepEqual([p.scale, p.minTextPt, p.noRoom, p.name], [null, null, false, COVER_SLIDE.title]);
  const boxes = [...p.xml.matchAll(/<a:bodyPr [^>]*>[\s\S]*?<a:pPr[^>]*>/g)].map(m => m[0]);
  assert.equal(boxes.length, 5);
  for (const b of boxes) assert.match(b, /^<a:bodyPr wrap="none" [\s\S]*<a:pPr algn="ctr">$/);
  const plain = planDeckSlide({title: 'ふつう', lead: 'リード'}, fontsOf(), fixed);
  assert.doesNotMatch(plain.xml, /algn=|wrap="none"/);
  const r = await renderDeckPptxEdge({slides: [COVER_SLIDE, {title: '二枚目', lead: 'ふつうのスライド。'}]}, realEngine(), {rasterize: () => new Uint8Array()});
  assert.deepEqual([r.issues, r.warnings], [[], []]);
  const slide1 = unzipEntry(Buffer.from(r.pptx as Uint8Array), 'ppt/slides/slide1.xml').toString();
  for (const t of [COVER_SLIDE.event, COVER_SLIDE.title, COVER_SLIDE.date, COVER_SLIDE.presenter]) assert.ok(slide1.includes(`<a:t>${t}</a:t>`), t);
});

test('the slide SVG: each line of a cover starts where its measured width leaves it in the middle; alt text in the order it is seen', () => {
  const box = (t: string, family: FontFamily, size: number, weight: number) => textBox(t, family, size, weight, JA_FONTS);
  const width: TextWidth = (t, size, bold) => box(t, 'sans', size, bold ? 700 : 400).w;
  const layout = planDeckLayout(COVER_SLIDE, undefined, width);
  const out = slideSvg(layout, undefined, outlineFontFromFiles(JA_FONTS), box);
  assert.deepEqual([out.missing, out.unsupported, out.liveEmoji], [[], [], []]);
  assert.deepEqual(checkSlideSvg(out.svg), {ok: true});
  const title = text(layout.top, 'title');
  assert.ok(title);
  const lineW = box(COVER_SLIDE.title, 'sans', title.size, 700).w;
  const group = new RegExp(`aria-label="${COVER_SLIDE.title}"><use href="[^"]+" transform="translate\\(([\\d.]+) `).exec(out.svg);
  assert.ok(group, 'the title is a group of glyphs');
  assert.ok(Math.abs(Number(group[1]) - (120 + (1040 - lineW) / 2)) < 0.02, `${group[1]} vs ${120 + (1040 - lineW) / 2}`);
  // a lead of two lines: the second line is centred on its own width
  const two = planDeckLayout({...COVER_SLIDE, lead: 'あいうえおかきくけこ'.repeat(5)}, undefined, width), lead = text(two.top, 'lead');
  assert.ok(lead && lead.lines.length === 2);
  const second = lead.lines[1]?.[0]?.text ?? '', svg2 = slideSvg(two, undefined, outlineFontFromFiles(JA_FONTS), box).svg;
  const g2 = new RegExp(`aria-label="${second}"><use href="[^"]+" transform="translate\\(([\\d.]+) `).exec(svg2);
  assert.ok(g2, 'the second line is a group of its own');
  assert.ok(Math.abs(Number(g2[1]) - (120 + (1040 - box(second, 'sans', 26, 400).w) / 2)) < 0.02);
  assert.equal(slideText({...COVER_SLIDE, source: '© 2026 例'}), [COVER_SLIDE.event, COVER_SLIDE.title, COVER_SLIDE.lead, COVER_SLIDE.date, COVER_SLIDE.presenter, '© 2026 例'].join('\n'));
});

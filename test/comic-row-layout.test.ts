// ADR 0074 実装メモ (row layouts and fontSize): 2x1 / 3x1 / 4x1 put the panels side by side; fontSize enlarges the dialogue text and the bubbles.
import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutComic, panelSize, aspectOf, LAYOUT_GRID, lineBudget} from '../lib/comic/layout.ts';
import {renderComicBand} from '../lib/comic/emit.ts';
import {metricsOf} from '../lib/comic/constants.ts';
import {comic} from '../lib/dsl-pure.ts';
import type {ComicDialogue, ComicLayoutName, ComicPanel, ComicWorksheet} from '../lib/types/comic.ts';

const widthOf = (atom: string) => atom.length * 9;
const panel = (id: string, dialogue: ComicDialogue[]): ComicPanel =>
  ({id, stage: [{who: 'me', at: 'left', expression: 'neutral'}, {who: 'col', at: 'right', expression: 'smile'}], dialogue});
const sheet = (layout: ComicLayoutName, n: number, line?: (i: number) => ComicDialogue): ComicWorksheet =>
  ({version: 1, title: 'テスト', layout, cast: {me: {name: '私'}, col: {name: '同僚'}}, panels: Array.from({length: n}, (_, i) => panel(`p${i + 1}`, line ? [line(i)] : []))});
const withBlank = (i: number): ComicDialogue => ({id: 'd1', who: 'me', kind: 'say', tpl: `今週は{day${i}}に帰ります。`, slots: {[`day${i}`]: {max: 3, prompt: '曜日'}}});
const lay = (s: ComicWorksheet, opts: {fontSize?: number} = {}) => layoutComic(comic(s, opts), 0, 0, 0, widthOf);

test('row layouts: the grid is columns x 1 row', () => {
  assert.deepEqual([LAYOUT_GRID['2x1'], LAYOUT_GRID['3x1'], LAYOUT_GRID['4x1']], [{cols: 2, rows: 1}, {cols: 3, rows: 1}, {cols: 4, rows: 1}]);
});

test('4x1 / 3x1: panels go left to right on one row, numbered in that order, with a taller default aspect', () => {
  for (const [layout, n] of [['4x1', 4], ['3x1', 3], ['2x1', 2]] as const) {
    const l = lay(sheet(layout, n));
    assert.equal(l.findings.length, 0, layout);
    assert.deepEqual(l.panels.map(p => p.label), Array.from({length: n}, (_, i) => String(i + 1)));
    const {w, h} = panelSize(layout, undefined);
    assert.equal(aspectOf(layout, undefined), '3:4');
    assert.ok(h > w, 'taller than wide');
    l.panels.forEach((p, i) => assert.deepEqual([p.x, p.y, p.w, p.h], [16 + i * (w + 16), 16, w, h]));
    assert.equal(l.w, 32 + n * w + (n - 1) * 16);
    assert.equal(l.h, 32 + h);
  }
});

test('4x1: the people stand inside their panels without their heads overlapping', () => {
  const l = lay(sheet('4x1', 4));
  for (const p of l.panels) {
    const [a, b] = p.heads;
    assert.ok(a!.cx - a!.r >= p.x && b!.cx + b!.r <= p.x + p.w);
    assert.ok(b!.cx - a!.cx >= 2 * a!.r);
  }
});

test('a wrong panel count is reported for a row layout', () => {
  assert.ok(lay(sheet('4x1', 3)).findings.some(f => f.rule === 'comic-panel-count'));
});

test('the line budget of a row panel is enough for two bubbles', () => {
  assert.ok(lineBudget(panelSize('4x1', undefined).h) >= 6);
});

test('fontSize enlarges the text, the lines, the blanks and the bubbles', () => {
  const s = sheet('4x1', 4, withBlank);
  const a = lay(s), b = lay(s, {fontSize: 24});
  const [ba, bb] = [a.bubbles[0]!, b.bubbles[0]!];
  assert.ok(bb.w > ba.w && bb.h > ba.h);
  assert.ok(bb.slots[0]!.w > ba.slots[0]!.w && bb.slots[0]!.h > ba.slots[0]!.h);
  assert.equal(bb.slots[0]!.w, 3 * 24);
  assert.deepEqual([...new Set(b.texts.filter(t => t.text.includes('今週')).map(t => t.size))], [24]);
  assert.match(renderComicBand(b), /font-size="24"/);
  assert.doesNotMatch(renderComicBand(b), /font-size="18"/);
  assert.equal(b.findings.length, 0);
});

test('fontSize left out or 18 changes nothing', () => {
  const s = sheet('4x1', 4, withBlank);
  assert.deepEqual(lay(s, {fontSize: 18}).bubbles, lay(s).bubbles);
  assert.equal(lay(s).fontSize, undefined);
});

test('with a larger fontSize, filling a blank does not move the geometry', () => {
  const s = sheet('4x1', 4, withBlank);
  const laid = lay(s, {fontSize: 24});
  const geometry = (svg: string) => [...svg.matchAll(/<(?:path|rect)\b[^>]*(?:stroke-linejoin|stroke-width="3")[^>]*>/g)].map(m => m[0]).join('');
  const empty = renderComicBand(laid, {}, widthOf), filled = renderComicBand(laid, {day0: '水曜日', day1: null}, widthOf);
  assert.ok(geometry(empty).length > 0);
  assert.equal(geometry(filled), geometry(empty));
  assert.deepEqual(lay(s, {fontSize: 24}).anchors, laid.anchors);
  // the blank drawn at the larger size, in bold, on a fitting value
  assert.match(filled, /font-size="24" font-weight="700"/);
  // a value too wide for its box shrinks inside the box, never beyond it
  const wide = renderComicBand(laid, {day0: '日曜日の午後'}, widthOf);
  assert.doesNotMatch(wide, /font-size="24" font-weight="700"/);
});

test('fontSize is validated', () => {
  const s = sheet('4x1', 4);
  for (const bad of [0, 10, 40, 18.5, Number.NaN]) assert.throws(() => comic(s, {fontSize: bad}), /fontSize/);
});

test('metricsOf: the default is the ADR 0074 numbers, and everything scales with the font', () => {
  assert.deepEqual(metricsOf(), {font: 18, lineH: 26, padX: 12, padY: 10, inner: 162, slotFont: 14, baseline: 19});
  assert.deepEqual(metricsOf(36), {font: 36, lineH: 52, padX: 24, padY: 20, inner: 324, slotFont: 28, baseline: 38});
});

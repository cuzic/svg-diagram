// ADR 0074 実装メモ (row layouts and fontSize): 2x1 / 3x1 / 4x1 put the panels side by side; fontSize enlarges the dialogue text and the bubbles.
import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutComic, panelSize, aspectOf, LAYOUT_GRID, lineBudget} from '../lib/comic/layout.ts';
import {templateAtoms} from '../lib/comic/reserve.ts';
import {comicMeasure} from '../lib/comic/measure.ts';
import {parseTemplate} from '../lib/comic/template.ts';
import {valueAtoms} from '../lib/comic/slot-values.ts';
import {checkDiagram, closeMeasurer, diagram} from '../lib/dsl.ts';
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
const lay = (s: ComicWorksheet, opts: {fontSize?: number} = {}, w = 0) => layoutComic(comic(s, opts), 0, 0, w, widthOf);

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
  // three people (left, centre, right) keep a gap between their heads
  const three = lay({...sheet('4x1', 4), panels: Array.from({length: 4}, (_, i) => ({id: `p${i + 1}`, stage: (['left', 'center', 'right'] as const).map((at, k) => ({who: k === 1 ? 'col' : 'me', at, expression: 'neutral' as const})), dialogue: []}))});
  for (const p of three.panels) {
    const xs = p.heads.map(h => h.cx);
    assert.ok(xs.length >= 2);
    for (let k = 1; k < xs.length; k++) assert.ok(xs[k]! - xs[k - 1]! >= 2 * 36 + 4, `${p.id}: ${xs.join(',')}`);
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
  assert.deepEqual(metricsOf(), {font: 18, lineH: 26, padX: 12, padY: 10, inner: 162, slotFont: 14, baseline: 19, badge: 24, badgeText: 14, badgeBase: 17, zoneTop: 16, narrationLeft: 20});
  assert.deepEqual(metricsOf(36), {font: 36, lineH: 52, padX: 24, padY: 20, inner: 324, slotFont: 28, baseline: 38, badge: 48, badgeText: 28, badgeBase: 34, zoneTop: 40, narrationLeft: 44});
});

const FIT_W = 1212; // the content width of canvas: 'slide'

test('row panels share the width the diagram gives the band: floor((w - 2 x 16 - gutters) / columns) on the 4px grid, at most 420', () => {
  assert.deepEqual(['4x1', '3x1', '2x1'].map(l => panelSize(l as ComicLayoutName, undefined, FIT_W).w), [280, 380, 420]);
  assert.deepEqual(['4x1', '3x1', '2x1'].map(l => panelSize(l as ComicLayoutName, undefined).w), [280, 380, 420]);
  assert.equal(panelSize('4x1', undefined, 900).w, 204);
  // the columns and the 2x2 do not look at the width
  assert.deepEqual([panelSize('1x4', undefined, 500).w, panelSize('2x2', undefined, 500).w], [420, 360]);
  for (const [layout, n] of [['4x1', 4], ['3x1', 3], ['2x1', 2]] as const) for (const w of [900, FIT_W]) {
    const l = lay(sheet(layout, n), {}, w);
    assert.ok(l.w <= w, `${layout} at ${w}: band ${l.w}`);
    assert.ok(l.x >= 0 && l.x + l.w <= w);
  }
});

const drawn = async (layout: ComicLayoutName, n: number, opts: object, comicOpts: {fontSize?: number} = {}) => {
  const s = sheet(layout, n, i => ({id: 'd1', who: 'me', kind: 'say', tpl: i === 0 ? 'はい。' : 'そうですね。'}));
  const r = await checkDiagram(diagram({theme: 'blue', legend: false, ...opts} as never).add(comic(s, comicOpts)));
  return r.verdict.problems.filter(p => /canvas|comic/.test(p));
};

test('a row layout fits canvas: slide, slide: true, and a plain diagram (no width override)', async () => {
  for (const [layout, n] of [['4x1', 4], ['3x1', 3], ['2x1', 2]] as const) {
    assert.deepEqual(await drawn(layout, n, {canvas: 'slide'}, {fontSize: 24}), [], `${layout} canvas`);
    assert.deepEqual(await drawn(layout, n, {slide: true}), [], `${layout} slide`);
    assert.deepEqual(await drawn(layout, n, {}), [], `${layout} plain`);
  }
  await closeMeasurer();
});

const quick = (who: string, tpl: string): ComicDialogue => ({id: `d-${who}`, who, kind: 'say', tpl});
const exchange = (a: string, b: string, order: 'ab' | 'ba' = 'ab'): ComicWorksheet => {
  const first = quick('me', a), second = quick('col', b);
  return {...sheet('4x1', 4), panels: Array.from({length: 4}, (_, i) => panel(`p${i + 1}`, order === 'ab' ? [first, second] : [second, first]))};
};

test('two speakers in one row panel: short lines sit side by side when the earlier bubble is on the left (ADR 0074 D2), and stack when the earlier one is on the right', () => {
  for (const fontSize of [14, 18, 22, 24, 26, 28]) {
    const ab = lay(exchange('はい。', 'うん。', 'ab'), {fontSize});
    assert.deepEqual(ab.findings, [], `${fontSize} ab`);
    const [x, y] = ab.bubbles.slice(0, 2);
    assert.equal(x!.y, y!.y, 'side by side: the same top');
    assert.ok(x!.x + x!.w < y!.x, 'the first is on the left');
    // the right speaker first: the reply (on the left) is under it, so it is read second
    const ba = lay(exchange('はい。', 'うん。', 'ba'), {fontSize});
    assert.deepEqual(ba.findings, [], `${fontSize} ba`);
    const [first, reply] = ba.bubbles.slice(0, 2);
    assert.ok(first!.x > reply!.x && reply!.y > first!.y, `${fontSize}: the reply is below`);
  }
});

test('two speakers in one row panel: a two-line reply at 18 has no findings (the lines wrap to half the panel)', () => {
  for (const order of ['ab', 'ba'] as const) {
    const l = lay(exchange('そうなんだ、いつから？', 'ええ、昨日決まったの。', order), {fontSize: 18});
    assert.deepEqual(l.findings, [], order);
    assert.ok(l.bubbles.slice(0, 2).every(b => b.lines.length === 2));
  }
});

test('when two speakers cannot sit side by side the finding names the limit', () => {
  const l = lay(exchange('そうなんだ、知らなかった、本当に驚いたよ。', 'ええ、昨日決まったばかりなの、ごめんね。'), {fontSize: 18});
  const f = l.findings.filter(x => x.rule === 'comic-tail-crosses-bubble' || x.rule === 'comic-text-budget');
  assert.ok(f.length > 0);
  assert.ok(f.some(x => /side by side|one bubble|at most/.test(x.message)), JSON.stringify(f));
});

test('a bubble in a row panel is as wide as its text; in a column or 2x2 it keeps the 9 em floor', () => {
  const row = lay(sheet('4x1', 4, () => ({id: 'd1', who: 'me', kind: 'say', tpl: 'はい。'})));
  assert.equal(row.bubbles[0]!.w, 80); // ceil4(3 em + 2 x 12)
  assert.equal(lay({...sheet('1x4', 4, () => ({id: 'd1', who: 'me', kind: 'say', tpl: 'はい。'}))}).bubbles[0]!.w, 188);
  assert.equal(lay({...sheet('2x2', 4, () => ({id: 'd1', who: 'me', kind: 'say', tpl: 'はい。'}))}).bubbles[0]!.w, 188);
});

test('fontSize 14 to 28: a short line fits every row layout, wide or narrow', () => {
  for (const layout of ['4x1', '3x1', '2x1'] as const) for (const fontSize of [14, 16, 18, 20, 22, 24, 26, 27, 28]) for (const w of [900, FIT_W]) {
    const n = LAYOUT_GRID[layout].cols;
    const l = lay(sheet(layout, n, () => ({id: 'd1', who: 'me', kind: 'say', tpl: 'うん。'})), {fontSize}, w);
    assert.deepEqual(l.findings, [], `${layout} ${fontSize}px at ${w}`);
  }
});

test('a bubble wider than its row panel is reported, and the message says how to fix it (fewer columns, smaller fontSize)', () => {
  const blank = (i: number): ComicDialogue => ({id: 'd1', who: 'me', kind: 'say', tpl: `{w${i}}`, slots: {[`w${i}`]: {max: 9, prompt: '長い'}}});
  const wide = lay(sheet('4x1', 4, blank), {fontSize: 28});
  const f = wide.findings.filter(x => x.rule === 'comic-bubble-zone' && /wider than the panel/.test(x.message));
  assert.equal(f.length, 4);
  assert.match(f[0]!.message, /smaller fontSize.*fewer columns/);
  // the same blank fits when the font is smaller, and in a wider row
  assert.deepEqual(lay(sheet('4x1', 4, blank), {fontSize: 24}).findings, []);
  assert.deepEqual(lay(sheet('2x1', 2, blank), {fontSize: 28}).findings, []);
  // and a column never reports it
  assert.equal(lay(sheet('1x4', 4, blank), {fontSize: 28}).findings.filter(x => /wider than the panel/.test(x.message)).length, 0);
});

test('comicMeasure registers the Latin runs at the band fontSize', () => {
  const band = comic(sheet('4x1', 4, () => ({id: 'd1', who: 'me', kind: 'say', tpl: 'Slack です'})), {fontSize: 24});
  const out = comicMeasure(band);
  assert.ok(out.length > 0 && out.every(([, size]) => size === 24));
});

test('the hiragana after a blank are glued while the unit fits 9 em of the font (24px: 7 em + 1 fits, past 9 em does not)', () => {
  const parts = parseTemplate('{a}ですね');
  const glue = (max: number, font: number) => templateAtoms(parts, () => max, () => font, font).map(a => a.glue === true);
  assert.deepEqual(glue(7, 24), [false, true, true, false]);
  assert.deepEqual(glue(9, 24), [false, false, false, false]);
});

test('valueAtoms asks for the band fontSize and the 14px floor', () => {
  const s = sheet('4x1', 4, withBlank);
  const laid = lay(s, {fontSize: 24});
  const sizes = new Set([...valueAtoms(laid, {day0: 'AB'})].map(r => r.size));
  assert.deepEqual([...sizes].sort((a, b) => a - b), [14, 24]);
});

test('the number badge, the blank prompts and the bubble zone grow with fontSize; the default is unchanged', () => {
  const s = sheet('4x1', 4, withBlank);
  const big = lay(s, {fontSize: 28}), base = lay(s);
  const svg = renderComicBand(big, {}, widthOf);
  assert.match(svg, /width="37" height="37"/);
  assert.match(svg, /font-size="22" font-weight="700"/); // the badge text: round(14 x 28 / 18)
  assert.match(svg, /font-size="22" fill=/); // the blank prompt
  assert.ok(big.bubbles[0]!.y - big.panels[0]!.y >= 37 - 8);
  assert.match(renderComicBand(base, {}, widthOf), /width="24" height="24"/);
  assert.equal(base.bubbles[0]!.y - base.panels[0]!.y, 16);
  assert.deepEqual(big.texts.filter(t => t.text === '1').map(t => t.size), [22]);
});

test('blank: "line" draws no prompt, so the prompt size is not among the sizes the band draws (the slide text floor)', () => {
  const s = {...sheet('4x1', 4, withBlank), blank: 'line' as const, numbering: false};
  assert.deepEqual([...new Set(lay(s, {fontSize: 24}).texts.map(t => t.size))], [24]);
  assert.ok(lay({...s, blank: 'prompt'}, {fontSize: 24}).texts.some(t => t.size === 19));
});

test('a row layout in a narrow diagram: panels keep their minimum width and one problem names the width needed (no broken panels, no negative budget)', async () => {
  for (const width of [480, 360]) {
    const w = width - 40;
    for (const [layout, n] of [['4x1', 4], ['3x1', 3]] as const) {
      const l = lay(exchange('はい。', 'うん。'), {}, w);
      const row = layout === '4x1' ? l : lay({...exchange('はい。', 'うん。'), layout, panels: exchange('はい。', 'うん。').panels.slice(0, n)}, {}, w);
      assert.equal(row.findings.filter(f => f.rule === 'comic-band-narrow').length, 1, `${layout} ${width}`);
      assert.match(row.findings.find(f => f.rule === 'comic-band-narrow')!.message, new RegExp(`width: ${32 + n * 200 + (n - 1) * 16}\\b`));
      assert.ok(row.panels.every(p => p.w === 200));
      for (const p of row.panels) {
        const [a, b] = p.heads;
        assert.ok(b!.cx - a!.cx >= 2 * 36 + 4 && a!.cx - 36 >= p.x && b!.cx + 36 <= p.x + p.w, `${layout} ${width}: ${p.id}`);
      }
      assert.ok(row.findings.every(f => !/-\d/.test(f.message)), 'no negative number in a message');
    }
    const problems = (await checkDiagram(diagram({theme: 'blue', legend: false, width} as never).add(comic(sheet('4x1', 4))))).verdict.problems;
    assert.ok(problems.some(p => /comic-band-narrow/.test(p) && /width: 920\b/.test(p)), `${width}: ${problems.join('|')}`);
  }
  // wide enough: no such finding
  assert.equal(lay(sheet('4x1', 4), {}, 900).findings.filter(f => f.rule === 'comic-band-narrow').length, 0);
  await closeMeasurer();
});

test('a narration keeps clear of the number badge at every fontSize (its left edge scales with the badge)', () => {
  const narr = (): ComicDialogue => ({id: 'd1', kind: 'narration', tpl: 'ある日。'});
  for (const [fontSize, left] of [[18, 20], [28, 32]] as const) {
    const l = lay(sheet('4x1', 4, narr), {fontSize});
    const b = l.bubbles[0]!;
    assert.equal(b.x - l.panels[0]!.x, left, `${fontSize}`);
    assert.ok(b.x - l.panels[0]!.x >= metricsOf(fontSize).badge - 8, 'clear of the badge');
  }
});

test('three people in a row panel narrower than 232px: one problem (heads would overlap); 232px and wider: none', () => {
  const three = (layout: ComicLayoutName, n: number): ComicWorksheet => ({...sheet(layout, n), panels: Array.from({length: n}, (_, i) => ({id: `p${i + 1}`, stage: (['left', 'center', 'right'] as const).map((at, k) => ({who: k === 1 ? 'col' : 'me', at, expression: 'neutral' as const})), dialogue: []}))});
  const narrow = lay(three('4x1', 4), {}, 900);
  const f = narrow.findings.filter(x => x.rule === 'comic-band-narrow');
  assert.equal(f.length, 1);
  assert.match(f[0]!.message, /center.*232px.*two people.*fewer columns.*wider diagram \(\d+px or more\)/);
  assert.equal(lay(three('4x1', 4), {}, 1212).findings.length, 0); // 280px panels
  assert.equal(lay(sheet('4x1', 4), {}, 900).findings.length, 0); // left / right only
});

test('the suggested diagram width follows the band\'s own padding (x), not a constant', () => {
  const l = layoutComic(comic(sheet('4x1', 4), {}), 30, 0, 300, widthOf);
  assert.match(l.findings.find(f => f.rule === 'comic-band-narrow')!.message, /width: 940/); // 880 + 2 x 30
});

test('an aspect too short for any bubble in a row: one actionable message, never a count below 1', () => {
  for (const aspect of ['7:5', '6:5'] as const) for (const fontSize of [18, 28]) for (const w of [900, 1212]) {
    const s = sheet('4x1', 4, () => ({id: 'd1', who: 'me', kind: 'say', tpl: 'はい。'}));
    const l = layoutComic(comic(s, {aspect, fontSize}), 0, 0, w, widthOf);
    const budget = l.findings.filter(f => f.rule === 'comic-text-budget' || f.rule === 'comic-bubble-zone');
    if (lineBudget(l.panels[0]!.h, fontSize) >= 1) continue;
    assert.equal(budget.length, 1, `${aspect} ${fontSize} ${w}`);
    assert.match(budget[0]!.message, /taller aspect.*3:4.*fewer columns.*smaller fontSize/);
    assert.doesNotMatch(budget[0]!.message, /at most -?\d/);
  }
});

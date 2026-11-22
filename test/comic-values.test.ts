import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderComicBand} from '../lib/comic/emit.ts';
import {valueFindings} from '../lib/comic/slot-values.ts';
import {lay, slotSvg, widthOf, withDay, withoutSlotsAndTitles} from './helpers/comic-values.ts';
import {SAMPLE} from './helpers/comic-sample.ts';

test('empty comic is byte-identical for omitted values, an empty table, and undefined', () => {
  const laid = lay();
  assert.equal(renderComicBand(laid, {}), renderComicBand(laid));
  assert.equal(renderComicBand(laid, {day: undefined!}), renderComicBand(laid));
});

test('slot ink, decoration and clip follow the three states', () => {
  const laid = lay();
  const empty = slotSvg(renderComicBand(laid, {}), 'day');
  assert.match(empty, /stroke-dasharray/);
  assert.match(empty, />曜日<\/text>/);

  const filled = slotSvg(renderComicBand(laid, {day: '水曜'}), 'day');
  assert.match(filled, /font-size="18"[^>]*font-weight="700"[^>]*fill="rgb\(185,28,28\)"[^>]*>水曜<\/text>/);
  assert.doesNotMatch(filled, /stroke-dasharray|曜日/);
  const {x, y, w, h} = laid.bubbles[0]!.slots[0]!;
  assert.ok(filled.includes(`<clipPath id="slot-clip-day"><rect x="${x}" y="${y - 4}" width="${w}" height="${h + 8}"/>`));
  assert.match(filled, /<text [^>]*clip-path="url\(#slot-clip-day\)"/);

  const skipped = slotSvg(renderComicBand(laid, {day: null}), 'day');
  assert.match(skipped, /fill="rgb\(111,102,89\)"[^>]*>…<\/text>/);
  assert.doesNotMatch(skipped, /font-weight|stroke-dasharray|曜日/);
  assert.match(skipped, /clip-path="url\(#slot-clip-day\)"/);
});

test('values shrink by ratio, stay at 14px if clipped, or fit at 18px', () => {
  const four = withDay({max: 4});
  for (const [sheet, day, size, overflow] of [
    [four, 'ABCDE', 14.4, false],
    [SAMPLE, 'ABCD', 14, true],
    [SAMPLE, 'ABC', 18, false],
    [SAMPLE, '月火水', 18, false],
  ] as const) {
    const laid = lay(sheet);
    const svg = slotSvg(renderComicBand(laid, {day}, widthOf), 'day');
    assert.ok(svg.includes(`font-size="${size}"`), day);
    assert.match(svg, /clip-path="url\(#slot-clip-day\)"/);
    const cut = valueFindings(sheet, laid, {day}, widthOf).filter(f => f.rule === 'slot-overflow');
    assert.deepEqual(cut.map(f => [f.severity, f.where]), overflow ? [['problem', 'day']] : [], day);
  }
});

test('a fallback uses normal weight and the same width and clipping rules', () => {
  const sheet = withDay({fallback: 'ABC'});
  const laid = lay(sheet);
  const measured: number[] = [];
  const width = (_text: string, size: number, weight: number) => { measured.push(weight); return size * 4; };
  const svg = slotSvg(renderComicBand(laid, {day: null}, width), 'day');
  assert.match(svg, /font-size="14"[^>]*>ABC<\/text>/);
  assert.deepEqual(measured, [400]);
  assert.deepEqual(valueFindings(sheet, laid, {day: null}, width).map(f => f.rule), ['slot-overflow']);
});

test('literal SVG is unchanged across states, and bubble titles follow what is drawn', () => {
  const sheet = withDay({fallback: '別日'});
  const laid = lay(sheet);
  const empty = renderComicBand(laid);
  for (const [day, title] of [['水曜', '水曜'], [null, '別日'], ['ABCDEFGH', 'ABCDEFGH'], ['<&', '&lt;&amp;']] as const) {
    const got = renderComicBand(laid, {day}, widthOf);
    assert.equal(withoutSlotsAndTitles(got), withoutSlotsAndTitles(empty));
    assert.ok(got.includes(`<title>今週から、毎週${title}は定時で上がります。</title>`));
    assert.match(got, /<title>えっ、＿＿は大丈夫なの？<\/title>/);
  }
  assert.match(empty, /<title>今週から、毎週＿＿は定時で上がります。<\/title>/);
});

test('value findings use one-line text, graphemes, strict choices and the slot id', () => {
  const invalid = (sheet: typeof SAMPLE, day: string) => valueFindings(sheet, lay(sheet), {day}, widthOf)
    .filter(f => f.rule === 'comic-value-invalid').map(f => [f.severity, f.where]);
  for (const value of ['abcd', '水\n曜', '水\x07曜', '   ', '水\n']) {
    assert.deepEqual(invalid(SAMPLE, value), [['problem', 'day']], JSON.stringify(value));
  }
  assert.deepEqual(invalid(withDay({max: 1}), '👨‍👩‍👧'), []);
  const choices = ['月曜', '火曜'];
  assert.deepEqual(invalid(withDay({choices, strict: true}), '水曜'), [['problem', 'day']]);
  assert.deepEqual(invalid(withDay({choices, strict: true}), '月曜'), []);
  assert.deepEqual(invalid(withDay({choices}), '水曜'), []);
  assert.deepEqual(valueFindings(SAMPLE, lay(), {zzz: 'x'}, widthOf).map(f => [f.rule, f.severity, f.where]), [
    ['comic-values-unknown', 'advice', 'zzz'],
  ]);
});

test('width quantization rounds each measured atom before summing it', () => {
  const laid = lay();
  const roundingEdge = (w: number) => (text: string, size: number) => {
    assert.equal(text, 'AB');
    assert.equal(size, 18);
    return w;
  };
  const under = slotSvg(renderComicBand(laid, {day: '月AB水'}, roundingEdge(18.124)), 'day');
  const over = slotSvg(renderComicBand(laid, {day: '月AB水'}, roundingEdge(18.125)), 'day');
  assert.match(under, /font-size="18"/);
  assert.match(over, /font-size="17.7"/);
});

test('values for a placeholder without a definition are ignored and reported', () => {
  const [first, ...others] = SAMPLE.panels;
  const d = first!.dialogue[0]!;
  const sheet = {...SAMPLE, panels: [{...first!, dialogue: [{id: d.id, kind: d.kind, who: 'me', tpl: d.tpl}]}, ...others]};
  const laid = lay(sheet);
  assert.equal(renderComicBand(laid, {day: '水曜'}), renderComicBand(laid));
  assert.deepEqual(valueFindings(sheet, laid, {day: '水曜'}).map(f => [f.rule, f.where]), [['comic-values-unknown', 'day']]);
});

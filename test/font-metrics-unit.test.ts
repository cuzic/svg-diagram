// lib/font-metrics.ts on its own (no browser): the properties the measurement must have whichever font the machine resolves to,
// the `fonts` settings, and the fallbacks. Skipped where no font file can be found. The comparison with Chromium is in
// font-metrics.test.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import {measureWithFonts, resolveFontFile} from '../lib/font-metrics.ts';
import type {FontFamily, MeasureRequest} from '../lib/types/core.ts';
import type {FontSpecs} from '../lib/types/project.ts';

const have = resolveFontFile('sans') !== null;
const t = (name: string, fn: () => void | Promise<void>) => test(name, {skip: have ? false : 'no sans font file found'}, fn);

const one = (text: string, size = 16, weight = 400, font: FontFamily = 'sans', specs?: FontSpecs) =>
  measureWithFonts(new Map<string, MeasureRequest>([['k', {text, size, weight, font}]]), specs).get('k')!;
const w = (text: string, size?: number, weight?: number, font?: FontFamily, specs?: FontSpecs) => one(text, size, weight, font, specs).w;

t('returns one result per request, under the request key, for every family and weight', () => {
  const reqs = new Map<string, MeasureRequest>([
    ['a', {text: 'Inventory', size: 14}],
    ['b', {text: 'Inventory', size: 14, weight: 700, font: 'sans'}],
    ['c', {text: 'x = 1', size: 14, font: 'mono'}],
  ]);
  const out = measureWithFonts(reqs);
  assert.deepEqual([...out.keys()], ['a', 'b', 'c']);
  for (const m of out.values()) { assert.ok(m.w > 0); assert.ok(Number.isInteger(m.h) && m.h > 0); }
  assert.deepEqual(measureWithFonts(new Map()), new Map());
});

t('is deterministic', () => {
  assert.equal(w('在庫管理 Inventory 86'), w('在庫管理 Inventory 86'));
  assert.deepEqual(one('Dashboard'), one('Dashboard'));
});

t('empty text is zero wide; a space is not; spaces add up', () => {
  assert.equal(w(''), 0);
  assert.ok(w(' ') > 0);
  assert.ok(Math.abs(w('   ') - 3 * w(' ')) < 1e-9);
});

t('width is proportional to the font size', () => {
  for (const text of ['Inventory management', '在庫管理アプリ', 'Total: ¥12,300']) {
    assert.ok(Math.abs(w(text, 40) - 2.5 * w(text, 16)) < 1e-6, text);
  }
});

t('height is a whole number of pixels that grows with the font size and stays near the size', () => {
  let last = 0;
  for (const size of [14, 16, 20, 24, 33, 48]) {
    const h = one('Ag', size).h;
    assert.ok(Number.isInteger(h));
    assert.ok(h >= last, `${size}px: ${h} < ${last}`);
    assert.ok(h >= size * 0.9 && h <= size * 2, `${size}px → ${h}`);
    last = h;
  }
});

t('height does not depend on the text', () => {
  assert.equal(one('Ag', 20).h, one('在庫', 20).h);
  assert.equal(one('', 20).h, one('Ag', 20).h);
});

t('a kanji and a kana are one em; half-width katakana are about half', () => {
  for (const size of [14, 16, 20]) {
    assert.ok(Math.abs(w('在', size) - size) < 0.01, `在 at ${size}`);
    assert.ok(Math.abs(w('あ', size) - size) < 0.01, `あ at ${size}`);
    assert.ok(w('ﾊ', size) > 0.4 * size && w('ﾊ', size) < 0.6 * size, `ﾊ at ${size}`);
  }
});

t('kerning is applied inside an atom: AV is not wider than A and V apart', () => {
  assert.ok(w('AV') <= w('A') + w('V') + 1e-9);
  assert.ok(w('WAVE') <= w('W') + w('A') + w('V') + w('E') + 1e-9);
});

t('bold is not narrower than regular for the same Latin text', () => {
  assert.ok(w('Inventory management', 16, 700) >= w('Inventory management', 16, 400) - 1e-9);
});

t('weights below 600 use the regular font, 600 and above the bold one', () => {
  assert.equal(w('Dashboard', 16, 400), w('Dashboard', 16, 500));
  assert.equal(w('Dashboard', 16, 600), w('Dashboard', 16, 700));
});

t('a character no font has is half an em (a narrow one) — and breaks an atom into separately shaped runs', () => {
  const pua = '';
  assert.equal(w(pua, 20), 10);
  assert.equal(w(`A${pua}B`, 20), w('A', 20) + 10 + w('B', 20));
});

t('a Japanese character in a mono stack is measured, in the sans font if the mono one lacks it', () => {
  const m = w('あ', 20, 400, 'mono');
  assert.ok(m > 0.4 * 20 && m <= 1.1 * 20, String(m));
});

t('a character the mono font lacks is measured by the sans font, not guessed as one em', () => {
  // half-width katakana: a mono Latin font has none; the sans font draws them half an em wide, the guess for a wide script is a whole em
  assert.ok(w('ﾊ', 20, 400, 'mono') < 15, String(w('ﾊ', 20, 400, 'mono')));
  assert.ok(Math.abs(w('ﾊ', 20, 400, 'mono') - w('ﾊ', 20, 400, 'sans')) < 0.01);
});

t('mono text is monospaced', () => {
  const widths = ['i', 'm', 'W', '0', '.'].map(c => w(c, 20, 400, 'mono'));
  for (const x of widths) assert.ok(Math.abs(x - widths[0]!) < 0.5, widths.join(' '));
});

t('resolveFontFile finds a readable file for each family it can, bold included', () => {
  const sans = resolveFontFile('sans')!;
  assert.match(sans.file, /\.(ttf|otf|ttc|otc)$/i);
  assert.ok(Number.isInteger(sans.index) && sans.index >= 0);
  assert.ok(resolveFontFile('sans', 700));
});

t('`fonts` names the files: path and path#index give what discovery gives', () => {
  const r = resolveFontFile('sans')!, b = resolveFontFile('sans', 700)!;
  const same: FontSpecs = {sans: {regular: `${r.file}#${r.index}`, bold: `${b.file}#${b.index}`}};
  for (const [text, weight] of [['Inventory', 400], ['在庫 Pending', 700]] as const) {
    assert.equal(w(text, 16, weight, 'sans', same), w(text, 16, weight));
  }
  if (r.index === 0) assert.equal(w('Inventory', 16, 400, 'sans', {sans: {regular: r.file}}), w('Inventory'));
});

t('`fonts` regular and bold are independent', () => {
  const r = resolveFontFile('sans')!;
  const boldIsRegular: FontSpecs = {sans: {bold: `${r.file}#${r.index}`}};
  assert.equal(w('Inventory management', 16, 700, 'sans', boldIsRegular), w('Inventory management', 16, 400));
  assert.equal(w('Inventory management', 16, 400, 'sans', boldIsRegular), w('Inventory management', 16, 400));
});

t('`fonts` for one family leaves the others alone', () => {
  const r = resolveFontFile('sans')!;
  const specs: FontSpecs = {sans: {regular: `${r.file}#${r.index}`}};
  assert.equal(w('x = 1', 16, 400, 'mono', specs), w('x = 1', 16, 400, 'mono'));
});

t('a `fonts` file that is not there is an error naming the file', () => {
  assert.throws(() => w('x', 16, 400, 'sans', {sans: {regular: '/no/such/dir/font.ttf'}}), /\/no\/such\/dir\/font\.ttf/);
});

t('without fontconfig and without `fonts`, the error says what to set', () => {
  const path = process.env['PATH'];
  process.env['PATH'] = '';
  try {
    // a spec object the earlier tests did not use, so this family is resolved afresh
    assert.throws(() => w('x', 16, 400, 'mono', {mono: {}}), (e: Error) => /no mono font file found/.test(e.message) && /\.svg-diagram\.json/.test(e.message) && /"measure": "chromium"/.test(e.message));
  } finally { process.env['PATH'] = path; }
});

// lib/font-subset.ts: a font cut to some characters is a valid, small font that shapes those characters as the original does.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as hb from 'harfbuzzjs';
import {subsetFont, heapBytes} from '../lib/font-subset.ts';
import {resolveFontFile} from '../lib/font-metrics.ts';

const sans = resolveFontFile('sans');
const skip = sans ? false : 'no font file found';
const cps = (s: string) => [...s].map(c => c.codePointAt(0)!);
const open = (bytes: Uint8Array, index = 0) => {
  const face = new hb.Face(new hb.Blob(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer), index);
  return {face, font: new hb.Font(face), upem: face.upem};
};
const advance = (f: ReturnType<typeof open>, text: string) => {
  const buf = new hb.Buffer(); buf.addText(text); buf.guessSegmentProperties(); hb.shape(f.font, buf);
  return buf.getGlyphPositions().reduce((a, p) => a + p.xAdvance, 0) / f.upem;
};
const original = () => fs.readFileSync(sans!.file);

test('the cut font is a valid font that has exactly the glyphs asked for (and .notdef)', {skip}, () => {
  const cut = subsetFont(original(), sans!.index, cps('Aあ在'));
  const f = open(cut);
  assert.deepEqual([...f.face.collectUnicodes()].sort((a, b) => a - b), cps('Aあ在').sort((a, b) => a - b));
});

test('it is much smaller than the original', {skip}, () => {
  const bytes = original();
  const cut = subsetFont(bytes, sans!.index, cps('Inventory 在庫管理'));
  assert.ok(cut.length < bytes.length / 20, `${cut.length} of ${bytes.length}`);
  assert.ok(cut.length > 1000);
});

test('widths and kerning of the kept characters are those of the original', {skip}, () => {
  const o = open(original(), sans!.index);
  const text = 'AV To Wave 在庫 Total: 1,240';
  const c = open(subsetFont(original(), sans!.index, cps(text)));
  assert.equal(c.upem, o.upem);
  for (const t of ['AV', 'To', 'Wave', '在庫', 'Total: 1,240', text]) assert.equal(advance(c, t), advance(o, t), t);
});

test('the family name survives (resvg picks the font by it)', {skip}, () => {
  const o = open(original(), sans!.index), c = open(subsetFont(original(), sans!.index, cps('abc')));
  assert.equal(c.face.getName(1, 'en'), o.face.getName(1, 'en'));
  assert.ok(c.face.getName(1, 'en').length > 0);
});

test('a character the font does not have is ignored; an empty set still gives a font', {skip}, () => {
  const c = open(subsetFont(original(), sans!.index, [...cps('A'), 0xE000, 0x10FFFF]));
  assert.deepEqual([...c.face.collectUnicodes()], [0x41]);
  const none = subsetFont(original(), sans!.index, []);
  assert.ok(none.length > 100);
  assert.deepEqual([...open(none).face.collectUnicodes()], []);
});

test('the same cut twice gives the same bytes', {skip}, () => {
  assert.deepEqual(subsetFont(original(), sans!.index, cps('在庫 Hello')), subsetFont(original(), sans!.index, cps('Hello 在庫')));
});

test('the face index of a collection picks the face; the cut is a single face', {skip}, () => {
  if (!/\.tt[c]$/i.test(sans!.file)) return;
  const bytes = original();
  const names = new Set<string>();
  for (let i = 0; i < 6; i++) {
    let cut: Uint8Array;
    try { cut = subsetFont(bytes, i, cps('A')); } catch { break; }
    names.add(`${open(cut).face.getName(1, 'en')}/${open(cut).face.getName(2, 'en')}`);
    assert.ok(open(cut).face.collectUnicodes().length <= 1);
  }
  assert.ok(names.size >= 1);
  assert.equal([...names][0].split('/')[0], open(bytes, sans!.index).face.getName(1, 'en'));
});

test('data that is not a font is refused, not turned into something', () => {
  assert.throws(() => subsetFont(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), 0, [0x41]), /could not read the font/);
  assert.throws(() => subsetFont(new Uint8Array(0), 0, [0x41]), /font subsetting/);
  assert.throws(() => subsetFont(Buffer.from('<svg/>'), 0, [0x41]), /font subsetting/);
});

test('a face index past the end of the collection is refused', {skip}, () => {
  assert.throws(() => subsetFont(original(), 99, [0x41]), /font subsetting/);
});

test('many cuts of a big font do not grow the wasm heap past the one cut\'s needs (nothing is leaked)', {skip, timeout: 120_000}, () => {
  const bytes = original();
  subsetFont(bytes, sans!.index, cps('warm up'));
  const after1 = heapBytes();
  for (let i = 0; i < 30; i++) subsetFont(bytes, sans!.index, cps(`round ${i} 在庫`));
  assert.ok(heapBytes() <= after1 * 1.5 + 16 * 1024 * 1024, `${after1} -> ${heapBytes()}`);
  assert.ok(heapBytes() < 600 * 1024 * 1024);
});

test('a failed cut leaves the subsetter usable', {skip}, () => {
  assert.throws(() => subsetFont(new Uint8Array([9, 9, 9, 9]), 0, [0x41]));
  assert.ok(subsetFont(original(), sans!.index, cps('A')).length > 100);
});

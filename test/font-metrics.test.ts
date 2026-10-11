// The font-file measurement against Chromium's, atom by atom (what layout measures). Where the font has no hinting quirks (the sans
// stack) widths agree within 1px and heights within 1px; a mono stack is held to Latin atoms and half a pixel per glyph, because Chromium
// rounds some advances of a hinted font (8.80 -> 9.00). Skipped on a machine where no font file can be found.
import test from 'node:test';
import assert from 'node:assert/strict';
import {measureAll, configureMeasure, closeMeasurer, splitAtoms} from '../lib/measure.ts';
import {measureWithFonts} from '../lib/font-metrics.ts';
import type {FontFamily, MeasureRequest} from '../lib/types.ts';

test.after(() => closeMeasurer());

const SAMPLES = [
  'Inventory management', 'Dashboard', 'AVATAR To Wave', 'WAVE Ty AY LT', '1,240', '86 / 100', 'Total: ¥12,300', 'ボルト M8 x 40',
  '在庫管理アプリの画面遷移図', '一覧から詳細へ、詳細から編集または発注へ', 'ナット (M8) の在庫が 86 個です', 'API v2 → レスポンス 200 OK',
  '「保存」を押すと確認画面へ進みます。', 'Status: 承認待ち / Pending', 'ﾊﾟｰﾄﾅｰ ID: A-0042', '2026-10-11 09:30', 'ABC ひらがな カタカナ 漢字',
];
const allAtoms = [...new Set(SAMPLES.flatMap(splitAtoms))];

for (const family of ['sans', 'mono'] as FontFamily[]) for (const weight of [400, 700]) for (const size of [14, 20]) {
  test(`${family} ${weight} ${size}px: atoms agree with Chromium`, async (t) => {
    const atoms = family === 'mono' ? allAtoms.filter(a => /^[\x20-\x7e]+$/.test(a)) : allAtoms;
    const requests = new Map<string, MeasureRequest>(atoms.map(a => [a, {text: a, size, weight, font: family}]));
    let fromFont;
    try { fromFont = measureWithFonts(requests); } catch (e) { t.skip((e as Error).message.slice(0, 80)); return; }
    configureMeasure({measure: 'chromium'});
    const fromChromium = await measureAll(requests);
    const off: string[] = [];
    for (const a of atoms) {
      const f = fromFont.get(a)!, c = fromChromium.get(a)!;
      const wTol = family === 'mono' ? 0.5 * [...a].length : 1;
      if (Math.abs(f.w - c.w) > wTol || Math.abs(f.h - c.h) > 1) off.push(`${JSON.stringify(a)} font ${f.w.toFixed(2)}×${f.h} chromium ${c.w.toFixed(2)}×${c.h}`);
    }
    assert.deepEqual(off, []);
  });
}

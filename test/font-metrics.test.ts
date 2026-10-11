// The font-file measurement against Chromium's, atom by atom (what layout measures). Where the font has no hinting quirks (the sans
// stack) widths agree within 1px and heights within 1px; a mono stack is held to Latin atoms and one pixel per glyph, because Chromium
// rounds some advances of a hinted font to a whole pixel, sometimes up (8.80 -> 9.00, 8.43 -> 9). Skipped on a machine where no font file can be found; the last test pins the default and the fallback.
import test from 'node:test';
import assert from 'node:assert/strict';
import {measureAll, configureMeasure, closeMeasurer, splitAtoms} from '../lib/measure.ts';
import {chromiumUsesOurFont} from './helpers/chromium-font.ts';
import {measureWithFonts, resolveFontFile} from '../lib/font-metrics.ts';
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
    if (!await chromiumUsesOurFont(family, weight)) { t.skip(`Chromium draws ${family} ${weight} with another font than ${resolveFontFile(family, weight)?.file}`); return; }
    const fromChromium = await measureAll(requests);
    const off: string[] = [];
    for (const a of atoms) {
      const f = fromFont.get(a)!, c = fromChromium.get(a)!;
      const wTol = family === 'mono' ? 1 * [...a].length : 1;
      if (Math.abs(f.w - c.w) > wTol || Math.abs(f.h - c.h) > 1) off.push(`${JSON.stringify(a)} font ${f.w.toFixed(2)}×${f.h} chromium ${c.w.toFixed(2)}×${c.h}`);
    }
    assert.deepEqual(off, []);
  });
}

test('the default is the font files; measure unset falls back to Chromium when none is found, measure "font" does not', async (t) => {
  const req = new Map<string, MeasureRequest>([['a', {text: 'Dashboard', size: 16, weight: 400, font: 'sans'}]]);
  const noFont = {sans: {regular: '/no/such/font.ttf'}};
  const env = process.env.SVG_DIAGRAM_MEASURE;
  delete process.env.SVG_DIAGRAM_MEASURE;
  try {
    try { measureWithFonts(req); } catch (e) { t.skip((e as Error).message.slice(0, 80)); return; }
    configureMeasure({});
    const viaDefault = await measureAll(req);
    assert.deepEqual(viaDefault.get('a'), measureWithFonts(req).get('a'));
    // an unreadable font file: unset → warns and measures in Chromium; "font" → throws
    const warnings: string[] = [];
    const warn = console.warn; console.warn = (m: string) => { warnings.push(m); };
    try {
      configureMeasure({fonts: noFont});
      const fallback = await measureAll(new Map([['b', {text: 'Dashboard', size: 17, weight: 400, font: 'sans' as const}]]));
      assert.ok(fallback.get('b')!.w > 0);
      assert.match(warnings.join('\n'), /measuring with Chromium instead/);
    } finally { console.warn = warn; }
    configureMeasure({measure: 'font', fonts: noFont});
    await assert.rejects(measureAll(new Map([['c', {text: 'Dashboard', size: 18, weight: 400, font: 'sans' as const}]])), /ENOENT|no such file/i);
  } finally {
    if (env !== undefined) process.env.SVG_DIAGRAM_MEASURE = env;
    configureMeasure({measure: 'chromium'});
  }
});

test('whole figures: the two engines draw the example diagrams to the same width and nearly the same height', async (t) => {
  if (!await chromiumUsesOurFont('sans', 400) || !await chromiumUsesOurFont('sans', 700)) return t.skip('Chromium draws sans with another font than the font engine reads');
  const {register} = await import('node:module');
  register(new URL('../lib/resolve-hook.ts', import.meta.url));
  const {loadDiagram} = await import('../lib/load-source.ts');
  const {renderDiagram} = await import('../lib/dsl.ts');
  const ROOT = new URL('..', import.meta.url).pathname;
  for (const name of ['inventory-flow', 'inventory-wireframe', 'inventory-component-spec']) {
    const render = async (measure: 'font' | 'chromium') => renderDiagram(await loadDiagram(`${ROOT}examples/${name}.ts`, {measure}), {name: `${name}.svg`, budget: 'cacheOnly'});
    const font = await render('font'), chromium = await render('chromium');
    assert.equal(font.verdict.ok, true, `${name}: font engine`);
    assert.equal(chromium.verdict.ok, true, `${name}: Chromium`);
    assert.equal(font.width, chromium.width, name);
    // a few pixels of rounding at most (plane.ts and wrapping ceil/round the widths)
    assert.ok(Math.abs(font.height - chromium.height) <= 8, `${name}: ${font.height} vs ${chromium.height}`);
  }
});

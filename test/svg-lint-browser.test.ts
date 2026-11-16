// The checks on a rendering, done on geometry (lib/svg-lint.ts), against the same checks in a real Chromium (lib/lint-browser.ts), on the
// example figures, on hand-made defects, and on seeded random scenes. They agree to within the rounding of the numbers they print; where
// they differ on purpose it is said below. Skipped where there is no browser, or where Chromium draws with another font than the layout's.
import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type {Page} from 'playwright-chromium';
import {launchChromium} from '../lib/browser.ts';
import {browserChecks} from '../lib/lint-browser.ts';
import {geometryChecks, type RenderChecks} from '../lib/geometry-checks.ts';
import {closeMeasurer} from '../lib/measure.ts';
import {chromiumUsesOurFont} from './helpers/chromium-font.ts';
import {scenes, STYLE} from './helpers/svg-fuzz.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
let browser: Awaited<ReturnType<typeof launchChromium>> | null = null, page: Page | null = null, why = '';

before(async () => {
  try {
    browser = await launchChromium({args: ['--no-sandbox']});
    page = await browser.newPage();
    if (!await chromiumUsesOurFont('sans', 400) || !await chromiumUsesOurFont('sans', 700)) why = 'Chromium draws the sans stack with another font than the layout measures';
  } catch (e) { why = `no browser: ${(e as Error).message.split('\n')[0]}`; }
});
after(async () => { await browser?.close(); await closeMeasurer(); });

const wrap = (body: string, w = 400, h = 200) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${STYLE}${body}</svg>`;

// numbers are printed after rounding, and widths are summed in float32 by the browser: a tie can fall either way, so a difference of 1 is the same answer
const same = (a: unknown, b: unknown, key = ''): boolean => {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= (key === 'ratio' ? 0.05 : 1.1);
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => same(x, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object') return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], k));
  return a === b;
};
// Intended difference: in a transformed group the browser version compares a text's box and a shape's box in two different coordinate
// systems (each as getBBox() reports it, untransformed); this version compares them where they are. So the contrast is not compared there.
const comparable = (c: RenderChecks | null, svg: string) => c && /transform=/.test(svg) ? {...c, contrast: []} : c;
const kinds = (c: RenderChecks | null) => c ? [c.contrast.length, c.overflow ? 1 : 0, c.textOverlap.length, c.containerOverflow.length, c.covered.length] : [0, 0, 0, 0, 0];

const MANUAL: [string, string][] = [
  ['low contrast', wrap('<rect x="10" y="10" width="200" height="60" fill="#dddddd"/><text x="20" y="45" font-size="20" fill="#e0e0e0">faint on grey</text><text x="20" y="120" font-size="20" fill="#000">fine</text>')],
  ['translucent background', wrap('<rect x="0" y="0" width="400" height="200" fill="#000000" fill-opacity="0.5"/><text x="20" y="45" font-size="20" fill="#666666">mid grey</text>')],
  ['overflow', wrap('<rect x="300" y="150" width="200" height="100" fill="#cccccc"/><text x="20" y="45" font-size="20">in</text>')],
  ['text over text', wrap('<text x="20" y="45" font-size="20">Overlapping</text><text x="24" y="50" font-size="20">Overlapping</text><text x="20" y="150" font-size="20">apart</text>')],
  ['text out of its box', wrap('<rect x="20" y="20" width="200" height="120" fill="#ffffff" stroke="#000"/><text x="25" y="45" font-size="18">too long for the box at all</text><rect x="240" y="20" width="140" height="120" fill="#fff" stroke="#000"/><text x="310" y="45" font-size="16" text-anchor="middle">fits</text>')],
  ['covered by a rect', wrap('<text x="20" y="45" font-size="20">hidden</text><rect x="10" y="20" width="120" height="40" fill="#ff0000"/><text x="20" y="120" font-size="20">visible</text><rect x="10" y="130" width="120" height="40" fill="#ff0000" data-allow-cover="1"/>')],
  ['crossed by a line', wrap('<text x="20" y="45" font-size="20">struck through</text><path d="M0 38 L300 38" stroke="#000" stroke-width="2" fill="none"/><text x="20" y="150" font-size="20">under</text><path d="M0 100 L300 100" stroke="#000" fill="none"/>')],
  ['rotated', wrap('<g transform="translate(40 30) rotate(15 100 60)"><rect x="50" y="40" width="120" height="40" fill="#ffffff" stroke="#000"/><text x="55" y="65" font-size="16">rotated label</text></g><text x="10" y="190" font-size="14">plain</text>')],
  ['tspans', wrap('<text x="20" y="50" font-size="18">A <tspan font-weight="700">bold</tspan> word</text><text x="20" y="90" font-size="18"><tspan x="20" dy="0">line one</tspan><tspan x="20" dy="22">line two</tspan></text>')],
  ['coloured tspans', wrap('<rect x="10" y="10" width="380" height="80" fill="#ffffff"/><text x="20" y="45" font-size="18" fill="#222222">dark then <tspan font-weight="700" fill="#eeeeee">pale tspan</tspan> then dark</text><text x="20" y="80" font-size="18" fill="#eeeeee"><tspan fill="#222222">all in a dark tspan</tspan></text><text x="20" y="130" font-size="18" fill="#222222">emoji <tspan class="emoji">x</tspan> inherits</text>')],
  ['css classes', wrap('<style>.t{fill:#ffffff;font-size:18px}.r{fill:#ffffff;stroke:#000}</style><rect class="r" x="20" y="20" width="200" height="50"/><text class="t" x="30" y="52">white on white</text>')],
  ['percent background', wrap('<rect width="100%" height="100%" fill="#ffffff"/><text x="10" y="40" font-size="18" fill="#fefefe">near white</text>')],
  ['arcs and curves', wrap('<path d="M20 100 A 40 40 0 0 1 100 100" stroke="#000" fill="none"/><text x="45" y="85" font-size="16">arc label</text><path d="M20 150 C 60 100, 140 200, 180 150" stroke="#000" fill="none"/><text x="70" y="150" font-size="16">cubic</text>')],
  ['a badge group', wrap('<g data-badge="1"><rect x="100" y="50" width="40" height="30" rx="14" fill="#fff" stroke="#000"/><text x="96" y="70" font-size="14" text-anchor="start">badge</text></g>')],
];

test('the example figures: both engines find the same (nothing)', async (t) => {
  if (why) return t.skip(why);
  for (const f of fs.readdirSync(path.join(ROOT, 'examples', 'out')).filter(f => f.endsWith('.svg'))) {
    const svg = fs.readFileSync(path.join(ROOT, 'examples', 'out', f), 'utf8');
    // the same tolerance as the other tests: glyph widths differ by a fraction of a pixel between the engines, and in a transformed group (math()) the contrast is judged in different coordinates on purpose (see `comparable`)
    const g = geometryChecks(svg), b = await browserChecks(page!, svg);
    assert.ok(same(comparable(g, svg), comparable(b, svg)), `${f}\n  browser : ${JSON.stringify(b)}\n  geometry: ${JSON.stringify(g)}`);
    assert.deepEqual(kinds(comparable(g, svg)), kinds(comparable(b, svg)), f); // what is found is the same, whatever the numbers
  }
});

test('hand-made defects: both engines find the same, and between them every check fires', async (t) => {
  if (why) return t.skip(why);
  const total = [0, 0, 0, 0, 0];
  for (const [name, svg] of MANUAL) {
    const b = await browserChecks(page!, svg), g = geometryChecks(svg);
    assert.ok(same(comparable(b, svg), comparable(g, svg)), `${name}\n  browser : ${JSON.stringify(b)}\n  geometry: ${JSON.stringify(g)}`);
    kinds(b).forEach((n, i) => total[i]! += n);
  }
  assert.ok(total.every(n => n > 0), `a check was never exercised: ${total}`);
});

for (const seed of [1, 7, 42, 2024]) {
  test(`random scenes, seed ${seed}: the engines agree on all but a few percent (rounding ties), and every check is exercised`, {timeout: 240_000}, async (t) => {
    if (why) return t.skip(why);
    const list = scenes(seed, 60);
    const differ: string[] = [];
    const total = [0, 0, 0, 0, 0];
    for (const [i, svg] of list.entries()) {
      const b = await browserChecks(page!, svg), g = geometryChecks(svg);
      kinds(b).forEach((n, k) => total[k]! += n);
      if (!same(comparable(b, svg), comparable(g, svg))) differ.push(`scene ${i}\n  browser : ${JSON.stringify(b)}\n  geometry: ${JSON.stringify(g)}`);
    }
    assert.ok(differ.length <= 4, `${differ.length} of ${list.length} scenes differ:\n${differ.slice(0, 3).join('\n')}`);
    assert.ok(total.every(n => n > 5), `a check was hardly exercised: ${total}`);
  });
}

test('seeded scenes are reproducible, and differ by seed', () => {
  assert.deepEqual(scenes(5, 3), scenes(5, 3));
  assert.notDeepEqual(scenes(5, 3), scenes(6, 3));
  assert.ok(scenes(5, 3).every(s => s.startsWith('<svg') && s.endsWith('</svg>')));
});

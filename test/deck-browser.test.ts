// ADR 0018 unit C: one smoke test of the viewer in a real Chromium (keys, the overview, the URL hash, print). Skipped where there is no
// browser. It looks at classes, attributes and counts of what is displayed — never at a size or a position (the fonts differ).
import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import type {Page} from 'playwright-chromium';
import {launchChromium} from '../lib/browser.ts';
import {buildDeck} from '../lib/deck-html.ts';
import {viewerAssets} from '../lib/deck-viewer.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
let browser: Awaited<ReturnType<typeof launchChromium>> | null = null, page: Page | null = null, why = '';
const errors: string[] = [];
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-browser-'));
const slidesOf = (names: string[]) => names.map(n => ({name: n, svg: fs.readFileSync(path.join(ROOT, 'examples/out', `${n}.svg`), 'utf8')}));

before(async () => {
  try {
    browser = await launchChromium({args: ['--no-sandbox']});
    page = await browser.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); // a Content-Security-Policy violation is reported here
  } catch (e) { why = `no browser: ${(e as Error).message.split('\n')[0]}`; }
});
after(async () => { await browser?.close(); fs.rmSync(dir, {recursive: true, force: true}); });

test("the viewer in Chromium: next -> #2, g opens the overview, Esc closes it, print shows every slide (under the deck's own CSP)", async t => {
  if (!page) return t.skip(why);
  const {css, js} = viewerAssets();
  const file = path.join(dir, 'deck.html');
  fs.writeFileSync(file, buildDeck(slidesOf(['bars', 'bpmn', 'arrow-weight']), {css, js, csp: true}));
  await page.goto(pathToFileURL(file).href);
  const shown = () => page!.evaluate(() => [...document.querySelectorAll('section.slide')].filter(s => getComputedStyle(s).display !== 'none').length);
  const svgs = () => page!.evaluate(() => document.querySelectorAll('svg').length);

  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('no-js')), false);
  assert.equal(await shown(), 1);
  const nSvg = await svgs();

  await page.focus('#deck');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => location.hash), '#2');
  assert.match(await page.evaluate(() => document.querySelector('[role=status]')!.textContent!), /^2 \/ 3: /);

  await page.keyboard.press('g');
  assert.equal(await page.evaluate(() => location.hash), '#grid');
  assert.equal(await shown(), 3);
  assert.equal(await svgs(), nSvg, 'the overview copies nothing');
  assert.match(await page.evaluate(() => document.activeElement!.getAttribute('aria-label')!), /^2 \/ 3: /);
  const pickShown = await page.evaluate(() => [...document.querySelectorAll('.deck-pick')].filter(b => getComputedStyle(b).display !== 'none').length);
  assert.equal(pickShown, 3);

  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.getElementById('deck')!.classList.contains('grid')), false);
  assert.equal(await shown(), 1);
  assert.equal(await page.evaluate(() => location.hash), '#2');
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('.deck-pick')].every(b => getComputedStyle(b).display === 'none')), true);

  await page.emulateMedia({media: 'print'});
  assert.equal(await shown(), 3, 'every slide in print');
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.deck-bar')!).display), 'none');
  await page.emulateMedia({media: 'screen'});

  assert.deepEqual(errors, []);
});

test('without script every slide is shown, one under the other', async t => {
  if (!browser) return t.skip(why);
  const ctx = await browser.newContext({javaScriptEnabled: false});
  try {
    const p = await ctx.newPage();
    const {css, js} = viewerAssets();
    const file = path.join(dir, 'nojs.html');
    fs.writeFileSync(file, buildDeck(slidesOf(['bars', 'bpmn']), {css, js}));
    await p.goto(pathToFileURL(file).href);
    const n = await p.evaluate(() => [...document.querySelectorAll('section.slide')].filter(s => getComputedStyle(s).display !== 'none').length);
    assert.equal(n, 2);
  } finally { await ctx.close(); }
});

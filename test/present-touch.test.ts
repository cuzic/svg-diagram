// The viewer's page (`serve`, `site`) on a phone held upright: the slide is a 16:9 strip in the middle of a tall screen. A pinch and a
// two-finger slide must zoom and move the slide wherever the fingers are, even on the black above and below it, and the browser must not
// zoom the page instead. Real touches through CDP in Chromium; skipped where there is no browser.
import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type {Browser, CDPSession, Page} from 'playwright-chromium';
import {launchChromium} from '../lib/browser.ts';
import {PRESENT_CSS, PRESENT_JS, viewerPage} from '../lib/present/ui.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const ORIGIN = 'http://deck.test';
let browser: Browser | null = null, why = '';

before(async () => {
  try { browser = await launchChromium({args: ['--no-sandbox']}); } catch (e) { why = `no browser: ${(e as Error).message.split('\n')[0]}`; }
});
after(async () => { await browser?.close(); });

/** A static viewer (ADR 0067) of one slide on a 390 × 844 touch screen. */
async function phone(): Promise<{page: Page; cdp: CDPSession; errors: string[]}> {
  const context = await browser!.newContext({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true, deviceScaleFactor: 2});
  const page = await context.newPage(), errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const svg = fs.readFileSync(path.join(ROOT, 'examples/out/bars.svg'), 'utf8');
  const files: Record<string, [string, string]> = {
    '/': ['text/html', viewerPage('題', {role: 'viewer', transport: 'static', events: '', slides: 'slides.json'}, {js: '/p.js', css: '/p.css'})],
    '/p.js': ['text/javascript', PRESENT_JS],
    '/p.css': ['text/css', PRESENT_CSS],
    '/slides.json': ['application/json', JSON.stringify({version: 1, title: '題', slides: [{url: 's/1.svg', title: '1', text: ''}]})],
    '/s/1.svg': ['image/svg+xml', svg],
  };
  await page.route(`${ORIGIN}/**`, route => {
    const f = files[new URL(route.request().url()).pathname];
    return f ? route.fulfill({contentType: f[0], body: f[1]}) : route.fulfill({status: 404, body: ''});
  });
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => (document.getElementById('slide') as HTMLImageElement | null)?.complete && (document.getElementById('slide') as HTMLImageElement).naturalWidth > 0);
  // the bar shows for a moment when the page opens; the fingers come after it has gone
  await page.waitForFunction(() => !document.getElementById('nav')!.classList.contains('show'), undefined, {timeout: 5000});
  return {page, cdp: await context.newCDPSession(page), errors};
}

type P = [number, number];
/** Two fingers from `from` to `to`, in `steps` moves. */
async function twoFingers(cdp: CDPSession, from: [P, P], to: [P, P], steps = 8): Promise<void> {
  const at = (k: number) => from.map((p, i) => ({x: p[0] + (to[i]![0] - p[0]) * k / steps, y: p[1] + (to[i]![1] - p[1]) * k / steps, id: i}));
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: at(0)});
  for (let k = 1; k <= steps; k++) await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: at(k)});
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
}

const state = (page: Page) => page.evaluate(() => {
  const r = document.getElementById('slide')!.getBoundingClientRect();
  return {zoom: document.getElementById('zreset')!.textContent, pageScale: window.visualViewport!.scale, left: r.left, top: r.top, width: r.width};
});

test('portrait phone: a pinch on the black above and below the slide zooms the slide, not the page', async t => {
  if (!browser) return t.skip(why);
  const {page, cdp, errors} = await phone();
  const strip = await page.evaluate(() => { const r = document.getElementById('zbox')!.getBoundingClientRect(); return {top: r.top, bottom: r.bottom}; });
  assert.ok(strip.top > 150 && strip.bottom < 700, `the slide is a strip in the middle (${strip.top}..${strip.bottom})`);
  await twoFingers(cdp, [[195, 120], [195, 724]], [[195, 40], [195, 804]]);
  const s = await state(page);
  assert.equal(s.pageScale, 1, 'the browser did not zoom the page');
  assert.notEqual(s.zoom, '100%', 'the slide zoomed');
  assert.deepEqual(errors, []);
  await page.context().close();
});

test('portrait phone: a pinch zooms around the point between the fingers', async t => {
  if (!browser) return t.skip(why);
  const {page, cdp} = await phone();
  const before = await page.evaluate(() => { const r = document.getElementById('slide')!.getBoundingClientRect(); return {left: r.left, top: r.top, width: r.width, height: r.height}; });
  // the point a quarter of the way into the slide (from the left and from the top) stays under the fingers
  const cx = before.left + before.width / 4, cy = before.top + before.height / 4;
  await twoFingers(cdp, [[cx - 30, cy], [cx + 30, cy]], [[cx - 60, cy], [cx + 60, cy]]);
  const after = await page.evaluate(() => { const r = document.getElementById('slide')!.getBoundingClientRect(); return {left: r.left, top: r.top, width: r.width, height: r.height}; });
  assert.ok(after.width > before.width * 1.5, `zoomed in (${before.width} -> ${after.width})`);
  assert.ok(Math.abs((cx - after.left) / after.width - 0.25) < 0.02, `x stays (${(cx - after.left) / after.width})`);
  assert.ok(Math.abs((cy - after.top) / after.height - 0.25) < 0.02, `y stays (${(cy - after.top) / after.height})`);
  await page.context().close();
});

test('portrait phone: two fingers sliding together move the zoomed slide sideways and up and down', async t => {
  if (!browser) return t.skip(why);
  const {page, cdp} = await phone();
  await twoFingers(cdp, [[165, 422], [225, 422]], [[105, 422], [285, 422]]); // zoom in first, in the middle
  const zoomed = await state(page);
  assert.notEqual(zoomed.zoom, '100%');
  await twoFingers(cdp, [[165, 422], [225, 422]], [[245, 422], [305, 422]]); // both fingers 80px to the right
  const moved = await state(page);
  assert.equal(moved.zoom, zoomed.zoom, 'sliding does not zoom');
  assert.ok(Math.abs(moved.left - zoomed.left - 80) < 2, `moved right with the fingers (${moved.left - zoomed.left})`);
  assert.ok(Math.abs(moved.top - zoomed.top) < 2, `and not up or down (${moved.top - zoomed.top})`);
  await twoFingers(cdp, [[165, 422], [225, 422]], [[165, 382], [225, 382]]); // and 40px up
  const up = await state(page);
  assert.ok(Math.abs(up.top - moved.top + 40) < 2, `moved up with the fingers (${up.top - moved.top})`);
  assert.ok(Math.abs(up.left - moved.left) < 2, `and not sideways (${up.left - moved.left})`);
  await page.context().close();
});

test('the bar, while hidden, lets a touch through to the slide (an unseen button is not pressed)', async t => {
  if (!browser) return t.skip(why);
  const {page} = await phone();
  const box = await page.evaluate(() => { const r = document.getElementById('nav')!.getBoundingClientRect(); return {x: r.left + r.width / 2, y: r.top + r.height / 2}; });
  assert.equal(await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.closest('nav') === null, [box.x, box.y]), true);
  await page.context().close();
});

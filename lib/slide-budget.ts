// Measures how tall an <img> can be on a given slide, instead of guessing.
//
// The budget depends on the slide's own body text, so it can only be known by
// laying the slide out: this renders it in a throwaway Slidev dev server,
// hides the target <img>, finds where the remaining in-flow content ends, and
// returns what is left above the bottom limit (the same ~6% bottom band
// check-slide-overflow.ts flags). Also returns the image's real available
// width, so fit.ts doesn't have to assume one.
//
// Results are cached in .cache/slide-budget.json, keyed by page+heading and
// validated by a hash of (the slide's markdown with the img's max-height
// stripped) + (the theme files that affect layout). Changing only the img's
// max-height — which is what the budget feeds — does not invalidate the cache;
// editing the slide's text, style.css, uno.config.ts, global-bottom.vue or
// slides.md does. A cache hit costs no browser and no dev server.
//
// Usage (module): getSlideBudget({page, heading, svg}) ->
//   {maxHeight, contentWidth, index, cached}
// CLI: node scripts/svg-diagram/lib/slide-budget.ts <page.md> "<heading>" <svg-file> [--refresh]

import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {launchChromium} from './browser.ts';
import {computeSlideIndex} from './slide-index.ts';
import type {SlideBudget} from './types.ts';

const SLIDE_W = 980, SLIDE_H = 552;
// Content may extend to here; matches what check-slide-overflow.ts tolerates
// (bottom 6% band is 519px; content boxes may end at 520 with their own margin).
export const BOTTOM_LIMIT = 520;
const CACHE_FILE = '.cache/slide-budget.json';
const LAYOUT_FILES = ['slides.md', 'style.css', 'uno.config.ts', 'global-bottom.vue'];

function slideMarkdown(pageFile: string, heading: string): string {
  const segs = fs.readFileSync(pageFile, 'utf8').split(/\n---\n/);
  const i = segs.findIndex(s => /^# (.+)$/m.test(s) && s.match(/^# (.+)$/m)![1].includes(heading));
  if (i < 0) throw new Error(`heading "${heading}" not found in ${pageFile}`);
  const prev = i > 0 && !/^# /m.test(segs[i - 1]) ? segs[i - 1] : ''; // frontmatter segment
  return prev + '\n---\n' + segs[i];
}

export function cacheKey(pageFile: string, heading: string, svg: string): string {
  const md = slideMarkdown(pageFile, heading).replace(/max-height:\s*\d+px;?\s*/g, '');
  const h = crypto.createHash('sha256').update(md).update('\0' + svg);
  for (const f of LAYOUT_FILES) if (fs.existsSync(f)) h.update('\0' + fs.readFileSync(f));
  return h.digest('hex').slice(0, 16);
}

function readCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch { return {}; }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, () => { const {port} = s.address() as net.AddressInfo; s.close(() => resolve(port)); });
    s.on('error', reject);
  });
}

async function withDevServer<T>(fn: (base: string) => Promise<T>): Promise<T> {
  const port = await freePort();
  const child = spawn('npx', ['slidev', 'slides.md', '--port', String(port)], {detached: true, stdio: 'ignore'});
  try {
    const base = `http://localhost:${port}`;
    for (let i = 0; ; i++) {
      if (i > 90) throw new Error('slidev dev server did not start within 90s');
      try { if ((await fetch(base + '/')).ok) break; } catch { /* not up yet */ }
      await new Promise(r => setTimeout(r, 1000));
    }
    return await fn(base);
  } finally {
    try { process.kill(-child.pid!); } catch { /* already gone */ }
  }
}

// name.svg, or one of its click stages name.revealN.svg (every stage has the same size); CSS can't match \d+, so the stage suffix is matched by prefix
export function imgSelector(scope: string, svg: string): string {
  const stem = svg.replace(/\.svg$/, '');
  return `${scope} img[src$="/svg/${svg}"], ${scope} img[src*="/svg/${stem}.reveal"][src$=".svg"], ${scope} img[src^="data:image/svg"]`;
}

async function measure(base: string, index: number, svg: string) {
  const browser = await launchChromium();
  try {
    const p = await browser.newPage({viewport: {width: SLIDE_W, height: SLIDE_H}});
    // Vite may inline a small SVG as a data: URI, so match by path first and
    // fall back to "the one SVG image in the slide".
    // The dev DOM holds many slides at once; scope to this slide's page node.
    const scope = `.slidev-page-${index} .slidev-layout`;
    const sel = imgSelector(scope, svg);
    await p.goto(`${base}/${index}?clicks=99`);
    await p.waitForSelector(sel, {state: 'attached', timeout: 60000});
    if ((await p.locator(sel).count()) !== 1) throw new Error(`slide ${index}: expected exactly one SVG <img> matching ${svg}, found ${await p.locator(sel).count()}`);
    await p.waitForTimeout(800); // fonts + v-click settle
    return await p.evaluate(({sel, limit}) => {
      const img = document.querySelector(sel) as HTMLElement; // existence was checked above (exactly one match)
      const layout = img.closest('.slidev-layout')!;
      const cs = getComputedStyle(img);
      const margins = (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
      const prevDisplay = img.style.display;
      img.style.display = 'none';
      // in-flow content only: absolutely-positioned badges don't consume height
      let bottom = 0;
      for (const el of layout.children) {
        const pos = getComputedStyle(el).position;
        if (pos === 'absolute' || pos === 'fixed') continue;
        bottom = Math.max(bottom, el.getBoundingClientRect().bottom);
      }
      img.style.display = prevDisplay;
      const parent = img.parentElement!.getBoundingClientRect();
      const pcs = getComputedStyle(img.parentElement!);
      const contentWidth = parent.width - (parseFloat(pcs.paddingLeft) || 0) - (parseFloat(pcs.paddingRight) || 0);
      return {maxHeight: Math.floor(limit - bottom - margins), contentWidth: Math.floor(contentWidth)};
    }, {sel, limit: BOTTOM_LIMIT});
  } finally {
    await browser.close();
  }
}

// The cached budget for this slide, or null when there is none (or it is stale). Starts no dev server and writes nothing —
// for callers (`svg-diagram show`) that must not have side effects.
export function readSlideBudgetCache({page, heading, svg, slidesMd = 'slides.md'}: {page: string; heading: string; svg: string; slidesMd?: string}): SlideBudget | null {
  try {
    const index = computeSlideIndex(slidesMd, page, heading);
    const hit = readCache()[`${path.relative('.', page)}#${heading}#${svg}`];
    return hit && hit.hash === cacheKey(page, heading, svg) ? {...hit.result, index, cached: true} : null;
  } catch { return null; }
}

export async function getSlideBudget({page, heading, svg, slidesMd = 'slides.md', refresh = false}: {page: string; heading: string; svg: string; slidesMd?: string; refresh?: boolean}): Promise<SlideBudget> {
  const index = computeSlideIndex(slidesMd, page, heading);
  const key = `${path.relative('.', page)}#${heading}#${svg}`;
  const hash = cacheKey(page, heading, svg);
  const cache = readCache();
  const hit = cache[key];
  if (!refresh && hit && hit.hash === hash) return {...hit.result, index, cached: true};

  const result = await withDevServer((base: string) => measure(base, index, svg));
  cache[key] = {hash, result, measuredAt: new Date().toISOString()};
  fs.mkdirSync(path.dirname(CACHE_FILE), {recursive: true});
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2) + '\n');
  return {...result, index, cached: false};
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const [page, heading, svg] = process.argv.slice(2).filter(a => !a.startsWith('--'));
  if (!page || !heading || !svg) { console.error('Usage: slide-budget.ts <page.md> "<heading>" <svg-file> [--refresh]'); process.exit(2); }
  console.log(JSON.stringify(await getSlideBudget({page, heading, svg, refresh: process.argv.includes('--refresh')})));
}

// Batch text measurement for the diagram DSL, via headless Chromium.
//
// Splits text into "break atoms" — the smallest units worth measuring once
// and reusing — instead of re-measuring every prefix of a string (which is
// what naive greedy line-wrapping does: O(n^2) measurement calls in string
// length). CJK characters have ~zero inter-glyph kerning, so each one is its
// own atom and summed widths are exact; Latin/digit/punctuation runs DO have
// real kerning, so they're kept together as one atom each, which folds that
// kerning into the single measurement instead of losing it.
//
// Nodes use xml:space="preserve": SVG otherwise collapses a whitespace-only <text> to
// width 0, which made every space in a wrapped line (~4px at 14px) go uncounted and
// let lines overflow their box by (spaces x 4)px.
//
// Uses getBBox() rather than getComputedTextLength() specifically because
// lint-svg.ts's own container-overflow check uses getBBox() — measuring
// with the same primitive the linter checks against means a diagram that
// passes layout here cannot then disagree with lint-svg.ts about whether
// something fits.

import type {Browser} from 'playwright-chromium';
import {launchChromium} from './browser.ts';
import {svgSize} from './raster.ts';
import type {Raster} from './raster.ts';
import {FONT_STACKS} from './tokens.ts';
import {splitAtoms, textWidth} from './atoms.ts';
import type {Config, FontFamily, FontSpecs, MeasureRequest, Measured, WidthOf} from './types.ts';
import {loadConfig} from './config.ts';

// splitAtoms / textWidth live in atoms.ts (pure); re-exported so existing imports keep working.
export {splitAtoms, textWidth};

function escapeXml(s: string): string {
  return s.replace(/[&<>]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[c as '&' | '<' | '>']));
}

let browserPromise: Promise<Browser> | null = null;
function getBrowser(): Promise<Browser> {
  browserPromise ??= launchChromium({args: ['--no-sandbox']}).catch(e => { browserPromise = null; throw e; });
  return browserPromise;
}

// Call once after all measureAll() calls for a build are done (or let the
// process exit naturally — Playwright doesn't need an explicit close if the
// process is about to end, but build-diagram.ts calls this for a clean exit
// when building many diagrams in one process).
// The measuring browser, for callers that must draw with the same engine (svg-diagram show).
export {getBrowser};

/**
 * Draw `svg` the way a page's <img src="x.svg"> does — as an image document, parsed as XML, with this browser's fonts —
 * scaled by `scale`, on white. An SVG that is not well-formed XML fails to load as an <img>; that is reported here as an
 * error rather than drawn from a forgiving HTML parse. Reuses the measuring browser, so a .ts source costs no extra launch.
 */
export async function rasterizeInBrowser(svg: string, {scale = 1, png = false}: {scale?: number; png?: boolean} = {}): Promise<Raster> {
  const size = svgSize(svg);
  if (!size) throw new Error('the SVG has no width/height (or viewBox) on its root element');
  const width = Math.max(1, Math.round(size.w * scale)), height = Math.max(1, Math.round(size.h * scale));
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    const url = 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64');
    const out = await page.evaluate(async ({url, width, height, png}) => {
      const img = new Image();
      img.src = url;
      const timeout = new Promise<'timeout'>(r => setTimeout(() => r('timeout'), 30000));
      try { if ((await Promise.race([img.decode().then(() => 'ok' as const), timeout])) === 'timeout') return {error: 'the browser did not finish loading it as an <img> in 30 seconds (a font that will not load?)'}; }
      catch { return {error: 'the browser could not load it as an <img> (not well-formed XML?)'}; }
      const c = document.createElement('canvas');
      c.width = width; c.height = height;
      const g = c.getContext('2d')!;
      g.fillStyle = '#fff'; g.fillRect(0, 0, width, height);
      g.drawImage(img, 0, 0, width, height);
      const data = g.getImageData(0, 0, width, height).data;
      let bin = '';
      for (let i = 0; i < data.length; i += 0x8000) bin += String.fromCharCode(...data.subarray(i, i + 0x8000));
      return {rgba: btoa(bin), png: png ? c.toDataURL('image/png').split(',')[1] : undefined};
    }, {url, width, height, png});
    if ('error' in out) throw new Error(out.error);
    return {width, height, rgba: Buffer.from(out.rgba, 'base64'), png: out.png ? Buffer.from(out.png, 'base64') : undefined};
  } finally {
    await page.close();
  }
}

export async function closeMeasurer(): Promise<void> {
  if (browserPromise) {
    const b = await browserPromise;
    await b.close();
    browserPromise = null;
  }
}

// requests: Map<key, {text, size, weight?, font?: 'sans'|'mono'|'emoji'}>
// returns Map<key, {w, h}>
// Widths measured earlier in this process, so building many diagrams in one run measures each atom once.
const memo = new Map<string, Measured>();
const memoKey = (r: MeasureRequest) => JSON.stringify([backend, backend === 'font' ? fontSpecs ?? null : null, r.text, r.size, r.weight ?? 400, r.font ?? 'sans']);

// Which engine measures: 'font' (the font files read directly, no browser; the default) or 'chromium' (a headless browser).
// SVG_DIAGRAM_MEASURE overrides .svg-diagram.json's `measure`. Unconfigured, the first measurement reads the config from the cwd.
// When `measure` is not set anywhere and no font file can be found, measuring falls back to Chromium (with a warning, once);
// when it is set to 'font' that is an error, because the person asked for the font files.
let backend: 'chromium' | 'font' | null = null;
let explicit = false;
let fontSpecs: FontSpecs | undefined;
export function configureMeasure(cfg: Pick<Config, 'measure' | 'fonts'>): void {
  const env = process.env.SVG_DIAGRAM_MEASURE || undefined; // empty counts as unset
  if (env && env !== 'chromium' && env !== 'font') throw new Error(`SVG_DIAGRAM_MEASURE=${env}: expected 'chromium' or 'font'`);
  const chosen = (env as 'chromium' | 'font' | undefined) ?? cfg.measure;
  backend = chosen ?? 'font';
  explicit = chosen !== undefined;
  fontSpecs = cfg.fonts;
}

/** Which engine measures now, and whether the person chose it (`measure` / SVG_DIAGRAM_MEASURE) rather than it being the default. */
export function currentMeasure(): {backend: 'chromium' | 'font'; explicit: boolean} {
  if (!backend) configureMeasure(loadConfig());
  return {backend: backend!, explicit};
}

export async function measureAll(requests: Map<string, MeasureRequest>): Promise<Map<string, Measured>> {
  if (requests.size === 0) return new Map();
  if (!backend) configureMeasure(loadConfig());
  const result = new Map<string, Measured>();
  const todo = new Map<string, MeasureRequest>();
  for (const [key, r] of requests) {
    const hit = memo.get(memoKey(r));
    if (hit) result.set(key, hit); else todo.set(key, r);
  }
  if (todo.size === 0) return result;
  if (backend === 'font') {
    const {measureWithFonts} = await import('./font-metrics.ts');
    try {
      for (const [key, m] of measureWithFonts(todo, fontSpecs)) { memo.set(memoKey(todo.get(key)!), m); result.set(key, m); }
      return result;
    } catch (e) {
      if (explicit) throw e;
      console.warn(`svg-diagram: ${(e as Error).message.split(' Name the file')[0]} — measuring with Chromium instead (set "fonts" to measure from font files).`);
      backend = 'chromium';
    }
  }
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    const entries = [...todo.entries()];
    const nodes = entries.map(([, r], i) => {
      const stack = FONT_STACKS[r.font ?? 'sans'];
      const weight = r.weight ?? 400;
      return `<text id="m${i}" xml:space="preserve" x="0" y="100" font-family="${stack}" font-size="${r.size}" font-weight="${weight}">${escapeXml(r.text)}</text>`;
    }).join('\n');
    await page.setContent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="200">${nodes}</svg>`,
      {waitUntil: 'load'},
    );
    const dims = await page.evaluate((n: number) => {
      const out: [number, number][] = [];
      for (let i = 0; i < n; i++) {
        const b = (document.getElementById('m' + i) as unknown as SVGGraphicsElement).getBBox();
        out.push([b.width, b.height]);
      }
      return out;
    }, entries.length);
    entries.forEach(([key, r], i) => {
      const m = {w: dims[i][0], h: dims[i][1]};
      memo.set(memoKey(r), m);
      result.set(key, m);
    });
    return result;
  } finally {
    await page.close();
  }
}

// Convenience: measure every atom of every string in `strings` (deduped) at
// one (size, weight, font) combination, in a single Chromium round trip.
// Returns a lookup function atomWidth(atomText) -> number, plus the raw map
// if callers need heights too (atoms are all single-line so height is
// mostly uniform, but kept per-atom for exactness with mixed scripts).
export async function measureAtoms(strings: Iterable<string>, {size, weight, font}: {size: number; weight?: number; font?: FontFamily}) {
  const atomSet = new Set<string>();
  for (const s of strings) for (const a of splitAtoms(s)) atomSet.add(a);
  const requests = new Map([...atomSet].map(a => [a, {text: a, size, weight, font}]));
  const measured = await measureAll(requests);
  return {
    width: (atom: string) => measured.get(atom)?.w ?? 0,
    height: (atom: string) => measured.get(atom)?.h ?? size * 1.2,
    raw: measured,
  };
}

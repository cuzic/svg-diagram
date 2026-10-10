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

import {chromium} from 'playwright-chromium';
import type {Browser} from 'playwright-chromium';
import {FONT_STACKS} from './tokens.ts';
import type {FontFamily, MeasureRequest, Measured} from './types.ts';

function isCJK(ch: string): boolean {
  const c = ch.codePointAt(0)!;
  return (c >= 0x3000 && c <= 0x30ff)   // CJK punctuation, hiragana, katakana
    || (c >= 0x3400 && c <= 0x9fff)      // CJK unified ideographs (+ ext A)
    || (c >= 0xf900 && c <= 0xfaff)      // CJK compatibility ideographs
    || (c >= 0xff00 && c <= 0xffef);     // fullwidth forms
}

// Splits text into atoms: each CJK character alone, each run of whitespace
// alone, and each run of anything else (Latin words, digits, punctuation,
// emoji) kept together.
export function splitAtoms(text: string): string[] {
  const atoms: string[] = [];
  let buf = '';
  const flush = () => { if (buf) { atoms.push(buf); buf = ''; } };
  for (const ch of text) {
    if (isCJK(ch)) { flush(); atoms.push(ch); }
    else if (/\s/.test(ch)) { flush(); atoms.push(ch); }
    else { buf += ch; }
  }
  flush();
  return atoms;
}

function escapeXml(s: string): string {
  return s.replace(/[&<>]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[c as '&' | '<' | '>']));
}

let browserPromise: Promise<Browser> | null = null;
function getBrowser(): Promise<Browser> {
  browserPromise ??= chromium.launch({args: ['--no-sandbox']});
  return browserPromise;
}

// Call once after all measureAll() calls for a build are done (or let the
// process exit naturally — Playwright doesn't need an explicit close if the
// process is about to end, but build-diagram.ts calls this for a clean exit
// when building many diagrams in one process).
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
const memoKey = (r: MeasureRequest) => JSON.stringify([r.text, r.size, r.weight ?? 400, r.font ?? 'sans']);

export async function measureAll(requests: Map<string, MeasureRequest>): Promise<Map<string, Measured>> {
  if (requests.size === 0) return new Map();
  const result = new Map<string, Measured>();
  const todo = new Map<string, MeasureRequest>();
  for (const [key, r] of requests) {
    const hit = memo.get(memoKey(r));
    if (hit) result.set(key, hit); else todo.set(key, r);
  }
  if (todo.size === 0) return result;
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

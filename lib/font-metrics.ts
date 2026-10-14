// Text measurement from the font files themselves — the engine behind `"measure": "font"` in .svg-diagram.json.
//
// measure.ts asks a headless Chromium for each atom's getBBox. This reads the same numbers from the font: HarfBuzz (what
// Chromium shapes with) gives the advance of the atom, kerning and ligatures included, and the font's ascent/descent give the
// height (Chromium rounds each to whole pixels, so does this). No browser is started.
//
// Which file? The one Chromium would pick: the first family of FONT_STACKS that is installed (found with fontconfig's
// fc-match, and accepted only when it answers with that very family — fc-match always answers with something), at the regular or bold
// weight. `fonts` in the config names the files outright (`path` or `path#faceIndex`), which is what a machine without fontconfig needs
// and what makes the numbers the same on every machine.
//
// Where it differs from Chromium (test/font-metrics.test.ts holds the bounds): Chromium on Linux rounds some glyph advances of
// hinted fonts (Consolas: 8.80 -> 9.00 at 16px), so a long atom in such a font runs up to a pixel per glyph narrower here; its
// box height can differ by 1px for a few glyphs at small sizes; a character no font has is measured as 1em (wide scripts) or
// 0.5em; one the primary font lacks is looked up in the emoji font, then the sans one; bold of a family that has only a regular
// file is not synthesized (Chromium's synthetic bold is wider).
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import * as hb from 'harfbuzzjs';
import {FONT_STACKS} from './tokens.ts';
import type {FontFamily, FontSpecs, MeasureRequest, Measured} from './types.ts';

import {must} from './must.ts';
interface Loaded {file: string; index: number; name: string; face: hb.Face; font: hb.Font; upem: number; covered: Set<number>; ascender: number; descender: number}

const GENERIC = new Set(['sans-serif', 'serif', 'monospace']);
// CSS weight → fontconfig weight (what `fc-match family:weight=N` takes)
const FC_WEIGHT: [number, number][] = [[100, 0], [200, 40], [300, 50], [400, 80], [500, 100], [600, 180], [700, 200], [800, 205], [900, 210]];
const fcWeight = (w: number) => FC_WEIGHT.reduce((best, c) => Math.abs(c[0] - w) < Math.abs(best[0] - w) ? c : best)[1];

/** The family name in the font's name table (name ID 1), '' when it has none. */
function familyName(face: hb.Face): string {
  try { return face.getName(1, 'en') || ''; } catch { return ''; }
}

const loaded = new Map<string, Loaded>();
function load(file: string, index: number): Loaded {
  const key = `${file}#${index}`;
  let f = loaded.get(key);
  if (!f) {
    const buf = fs.readFileSync(file);
    const face = new hb.Face(new hb.Blob(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)), index);
    const font = new hb.Font(face);
    const ext = font.hExtents();
    f = {file, index, name: familyName(face), face, font, upem: face.upem, covered: new Set(face.collectUnicodes()), ascender: ext.ascender, descender: ext.descender};
    loaded.set(key, f);
  }
  return f;
}

function parseSpec(spec: string): {file: string; index: number} {
  const m = /^(.*)#(\d+)$/.exec(spec);
  return m ? {file: must(m[1]), index: Number(m[2])} : {file: spec, index: 0};
}

/** The first family of the stack that is installed, at this weight; null when there is no fontconfig or none of them is. */
function discover(family: FontFamily, weight: number): {file: string; index: number} | null {
  for (const raw of FONT_STACKS[family].split(',')) {
    const name = raw.trim().replace(/^['"]|['"]$/g, '');
    let out: string;
    try { out = execFileSync('fc-match', ['-f', '%{file}\t%{index}\t%{family}', `${name}:weight=${fcWeight(weight)}`], {encoding: 'utf8'}); }
    catch { return null; }
    const [file, index, fam] = out.split('\t');
    if (!file) continue;
    if (GENERIC.has(name) || must(fam).split(',').some(f => f.trim().toLowerCase() === name.toLowerCase())) return {file, index: Number(index) & 0xffff};
  }
  return null;
}

const resolved = new Map<string, Loaded | null>();
function fontFor(family: FontFamily, weight: number, specs?: FontSpecs, required = true): Loaded | null {
  const bold = weight >= 600;
  const key = `${family}|${bold}|${specs ? JSON.stringify(specs[family] ?? null) : ''}`;
  if (!resolved.has(key)) {
    const named = specs?.[family]?.[bold ? 'bold' : 'regular'];
    const spec = named ? parseSpec(named) : discover(family, bold ? 700 : 400);
    resolved.set(key, spec ? load(spec.file, spec.index) : null);
  }
  const f = resolved.get(key) ?? null; // null is a cached "no such font"
  if (!f && required) throw new Error(`measure: "font" — no ${bold ? 'bold ' : ''}${family} font file found (fontconfig's fc-match did not find any family of ${FONT_STACKS[family]}). Name the file in .svg-diagram.json: {"fonts": {"${family}": {"${bold ? 'bold' : 'regular'}": "/path/to/font.ttf"}}} (a .ttc: "/path/to/font.ttc#0"), or use "measure": "chromium".`);
  return f;
}

const WIDE = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹯＀-｠￠-￦\u{1f300}-\u{1faff}\u{20000}-\u{3fffd}]/u;

function advance(f: Loaded, text: string, size: number, weight: number): number {
  f.font.setVariations([new hb.Variation('wght', weight)]);
  const buf = new hb.Buffer();
  buf.addText(text);
  buf.guessSegmentProperties();
  hb.shape(f.font, buf);
  let units = 0;
  for (const p of buf.getGlyphPositions()) units += p.xAdvance;
  return units / f.upem * size;
}

// A character the primary font lacks is drawn by another font in Chromium: try the emoji font, then the sans one (what a
// mono stack's Japanese falls back to on a typical machine).
function fallbackFonts(family: FontFamily, weight: number, specs?: FontSpecs): Loaded[] {
  return (['emoji', 'sans'] as FontFamily[]).filter(f => f !== family).map(f => fontFor(f, weight, specs, false)).filter((f): f is Loaded => f !== null);
}

function measureText(f: Loaded, family: FontFamily, text: string, size: number, weight: number, specs?: FontSpecs): {w: number} {
  let w = 0, run = '';
  const flush = () => { if (run) { w += advance(f, run, size, weight); run = ''; } };
  for (const ch of text) {
    const cp = must(ch.codePointAt(0));
    if (f.covered.has(cp)) { run += ch; continue; }
    flush();
    const fb = fallbackFonts(family, weight, specs).find(x => x.covered.has(cp));
    if (fb) w += advance(fb, ch, size, weight);
    else w += (WIDE.test(ch) ? 1 : 0.5) * size;
  }
  flush();
  return {w};
}

/** The font that measures `emoji` (regular) as HarfBuzz objects, for reading its color glyphs (lib/emoji-color.ts); null when none can be found. */
export function emojiFontFace(specs?: FontSpecs): {face: hb.Face; font: hb.Font; upem: number; ascender: number; descender: number} | null {
  const f = fontFor('emoji', 400, specs, false);
  return f && {face: f.face, font: f.font, upem: f.upem, ascender: f.ascender, descender: f.descender};
}

/** The code points the font that measures `family` at this weight has a glyph for; null when none can be found. */
export function fontCoverage(family: FontFamily, weight = 400, specs?: FontSpecs): ReadonlySet<number> | null {
  return fontFor(family, weight, specs, false)?.covered ?? null;
}

/** Whether the fonts that measure sans, mono and emoji between them have a glyph for every visible character of `text`. */
export function fontsCover(text: string, specs?: FontSpecs): boolean {
  const fonts = (['sans', 'mono', 'emoji'] as const).flatMap(f => [400, 700].map(w => fontFor(f, w, specs, false))).filter((f): f is Loaded => f !== null);
  if (!fonts.length) return false;
  for (const ch of new Set(text)) {
    const cp = must(ch.codePointAt(0));
    if (/\s/.test(ch) || cp < 0x20 || cp === 0x7f || cp === 0xfe0f || cp === 0x200d) continue;
    if (!fonts.some(f => f.covered.has(cp))) return false;
  }
  return true;
}

/** The font file (and face index, and the family name inside it) that measures `family` at this weight, or null when none can be found. */
export function resolveFontFile(family: FontFamily, weight = 400, specs?: FontSpecs): {file: string; index: number; name: string} | null {
  const f = fontFor(family, weight, specs, false);
  return f ? {file: f.file, index: f.index, name: f.name} : null;
}

/** The box Chromium gives a line of text at `size`: the font's ascent and descent, each rounded to a whole pixel, and the advance of `text`. */
export function textBox(text: string, family: FontFamily, size: number, weight = 400, specs?: FontSpecs): {w: number; ascent: number; descent: number} {
  const f = must(fontFor(family, weight, specs));
  return {
    w: measureText(f, family, text, size, weight, specs).w,
    ascent: Math.round(f.ascender / f.upem * size),
    descent: Math.round(-f.descender / f.upem * size),
  };
}

/** The widths and heights measure.ts would get from Chromium, read from the font files. Synchronous: no browser. */
export function measureWithFonts(requests: Map<string, MeasureRequest>, specs?: FontSpecs): Map<string, Measured> {
  const out = new Map<string, Measured>();
  for (const [key, r] of requests) {
    const weight = r.weight ?? 400;
    const family = r.font ?? 'sans';
    const m = measureText(must(fontFor(family, weight, specs)), family, r.text, r.size, weight, specs);
    // Chromium's text box is the primary font's ascent and descent, each rounded to a whole pixel (a fallback font's are not
    // added: tried, and a mono stack's Japanese came out 1-2px taller than Chromium's box)
    const f = must(fontFor(family, weight, specs));
    out.set(key, {w: m.w, h: Math.round(f.ascender / f.upem * r.size) + Math.round(-f.descender / f.upem * r.size)});
  }
  return out;
}

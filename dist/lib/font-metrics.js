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
import { execFileSync } from 'node:child_process';
import { FONT_STACKS } from './tokens.js';
import { must } from './must.js';
// HarfBuzz is optional (a machine that only has a browser, such as ChatGPT's Code Interpreter, has none): the import is tried once, here, and
// asking for it later says what to do instead. measure.ts takes that message as "no font file" and measures with Chromium unless the person asked for fonts.
const hbModule = await import('harfbuzzjs').catch(() => null);
export function harfbuzz() {
    if (!hbModule)
        throw new Error('measure: "font" — harfbuzzjs is not installed, so the font files cannot be read. Use "measure": "chromium" (SVG_DIAGRAM_MEASURE=chromium) with a browser instead. Name the file in .svg-diagram.json to use fonts.');
    return hbModule;
}
/** Whether the font files can be read at all (HarfBuzz is installed). */
export const hasHarfbuzz = hbModule !== null;
const GENERIC = new Set(['sans-serif', 'serif', 'monospace']);
// CSS weight → fontconfig weight (what `fc-match family:weight=N` takes)
const FC_WEIGHT = [[100, 0], [200, 40], [300, 50], [400, 80], [500, 100], [600, 180], [700, 200], [800, 205], [900, 210]];
const fcWeight = (w) => FC_WEIGHT.reduce((best, c) => Math.abs(c[0] - w) < Math.abs(best[0] - w) ? c : best)[1];
/** The family name in the font's name table (name ID 1), '' when it has none. */
function familyName(face) {
    try {
        return face.getName(1, 'en') || '';
    }
    catch {
        return '';
    }
}
const loaded = new Map();
function load(file, index) {
    const key = `${file}#${index}`;
    let f = loaded.get(key);
    if (!f) {
        const hb = harfbuzz();
        const buf = fs.readFileSync(file);
        const face = new hb.Face(new hb.Blob(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)), index);
        const font = new hb.Font(face);
        const ext = font.hExtents();
        f = { file, index, name: familyName(face), face, font, upem: face.upem, covered: new Set(face.collectUnicodes()), ascender: ext.ascender, descender: ext.descender };
        loaded.set(key, f);
    }
    return f;
}
function parseSpec(spec) {
    const m = /^(.*)#(\d+)$/.exec(spec);
    return m ? { file: must(m[1]), index: Number(m[2]) } : { file: spec, index: 0 };
}
/** The first family of the stack that is installed, at this weight; null when there is no fontconfig or none of them is. */
function discover(family, weight) {
    for (const raw of FONT_STACKS[family].split(',')) {
        const name = raw.trim().replace(/^['"]|['"]$/g, '');
        let out;
        try {
            out = execFileSync('fc-match', ['-f', '%{file}\t%{index}\t%{family}', `${name}:weight=${fcWeight(weight)}`], { encoding: 'utf8' });
        }
        catch {
            return null;
        }
        const [file, index, fam] = out.split('\t');
        if (!file)
            continue;
        if (GENERIC.has(name) || must(fam).split(',').some(f => f.trim().toLowerCase() === name.toLowerCase()))
            return { file, index: Number(index) & 0xffff };
    }
    return null;
}
const resolved = new Map();
function fontFor(family, weight, specs, required = true) {
    const bold = weight >= 600;
    const key = `${family}|${bold}|${specs ? JSON.stringify(specs[family] ?? null) : ''}`;
    if (!resolved.has(key)) {
        const named = specs?.[family]?.[bold ? 'bold' : 'regular'];
        const spec = named ? parseSpec(named) : discover(family, bold ? 700 : 400);
        resolved.set(key, spec ? load(spec.file, spec.index) : null);
    }
    const f = resolved.get(key) ?? null; // null is a cached "no such font"
    if (!f && required)
        throw new Error(`measure: "font" — no ${bold ? 'bold ' : ''}${family} font file found (fontconfig's fc-match did not find any family of ${FONT_STACKS[family]}). Name the file in .svg-diagram.json: {"fonts": {"${family}": {"${bold ? 'bold' : 'regular'}": "/path/to/font.ttf"}}} (a .ttc: "/path/to/font.ttc#0"), or use "measure": "chromium".`);
    return f;
}
const WIDE = /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹯＀-｠￠-￦\u{1f300}-\u{1faff}\u{20000}-\u{3fffd}]/u;
function advance(f, text, size, weight) {
    const hb = harfbuzz();
    f.font.setVariations([new hb.Variation('wght', weight)]);
    const buf = new hb.Buffer();
    buf.addText(text);
    buf.guessSegmentProperties();
    hb.shape(f.font, buf);
    let units = 0;
    for (const p of buf.getGlyphPositions())
        units += p.xAdvance;
    return units / f.upem * size;
}
// A character the primary font lacks is drawn by another font in Chromium: try the emoji font, then the sans one (what a
// mono stack's Japanese falls back to on a typical machine).
function fallbackFonts(family, weight, specs) {
    return ['emoji', 'sans'].filter(f => f !== family).map(f => fontFor(f, weight, specs, false)).filter((f) => f !== null);
}
function measureText(f, family, text, size, weight, specs) {
    let w = 0, run = '';
    const flush = () => { if (run) {
        w += advance(f, run, size, weight);
        run = '';
    } };
    for (const ch of text) {
        const cp = must(ch.codePointAt(0));
        if (f.covered.has(cp)) {
            run += ch;
            continue;
        }
        flush();
        const fb = fallbackFonts(family, weight, specs).find(x => x.covered.has(cp));
        if (fb)
            w += advance(fb, ch, size, weight);
        else
            w += (WIDE.test(ch) ? 1 : 0.5) * size;
    }
    flush();
    return { w };
}
/** The font that measures `emoji` (regular) as HarfBuzz objects, for reading its color glyphs (lib/emoji-color.ts); null when none can be found. */
export function emojiFontFace(specs) {
    const f = fontFor('emoji', 400, specs, false);
    return f && { face: f.face, font: f.font, upem: f.upem, ascender: f.ascender, descender: f.descender };
}
/** The code points the font that measures `family` at this weight has a glyph for; null when none can be found. */
export function fontCoverage(family, weight = 400, specs) {
    return fontFor(family, weight, specs, false)?.covered ?? null;
}
/** Whether the fonts that measure sans, mono and emoji between them have a glyph for every visible character of `text`. */
export function fontsCover(text, specs) {
    const fonts = ['sans', 'mono', 'emoji'].flatMap(f => [400, 700].map(w => fontFor(f, w, specs, false))).filter((f) => f !== null);
    if (!fonts.length)
        return false;
    for (const ch of new Set(text)) {
        const cp = must(ch.codePointAt(0));
        if (/\s/.test(ch) || cp < 0x20 || cp === 0x7f || cp === 0xfe0f || cp === 0x200d)
            continue;
        if (!fonts.some(f => f.covered.has(cp)))
            return false;
    }
    return true;
}
/** The font file (and face index, and the family name inside it) that measures `family` at this weight, or null when none can be found. */
export function resolveFontFile(family, weight = 400, specs) {
    const f = fontFor(family, weight, specs, false);
    return f ? { file: f.file, index: f.index, name: f.name } : null;
}
/** The box Chromium gives a line of text at `size`: the font's ascent and descent, each rounded to a whole pixel, and the advance of `text`. */
export function textBox(text, family, size, weight = 400, specs) {
    const f = must(fontFor(family, weight, specs));
    return {
        w: measureText(f, family, text, size, weight, specs).w,
        ascent: Math.round(f.ascender / f.upem * size),
        descent: Math.round(-f.descender / f.upem * size),
    };
}
/** The widths and heights measure.ts would get from Chromium, read from the font files. Synchronous: no browser. */
export function measureWithFonts(requests, specs) {
    harfbuzz(); // says so at once when there is none
    const out = new Map();
    for (const [key, r] of requests) {
        const weight = r.weight ?? 400;
        const family = r.font ?? 'sans';
        const m = measureText(must(fontFor(family, weight, specs)), family, r.text, r.size, weight, specs);
        // Chromium's text box is the primary font's ascent and descent, each rounded to a whole pixel (a fallback font's are not
        // added: tried, and a mono stack's Japanese came out 1-2px taller than Chromium's box)
        const f = must(fontFor(family, weight, specs));
        out.set(key, { w: m.w, h: Math.round(f.ascender / f.upem * r.size) + Math.round(-f.descender / f.upem * r.size) });
    }
    return out;
}
/**
 * The font files as the outlines of `serve`'s slides (ADR 0056 D2): the same file per family and weight as the measuring above, the same
 * `wght`, and a glyph the primary font lacks taken from the same fallbacks in the same order (a color font is left out: its glyphs are
 * pictures, not outlines, so such a character stays live text). A fallback's glyph is scaled to the primary font's units, and its id
 * carries which font it is from (outlineText keys glyphs by family, weight and id).
 */
export function outlineFontFromFiles(specs) {
    const hb = harfbuzz();
    const slots = [];
    const slotOf = (f) => { let i = slots.indexOf(f); if (i < 0) {
        slots.push(f);
        i = slots.length - 1;
    } return i; };
    const outlined = (f) => !(f.face.hasColorPng() || f.face.hasColorLayers());
    const fontOf = (family, weight, cp) => {
        const f = must(fontFor(family, weight, specs));
        if (f.covered.has(cp))
            return f;
        return fallbackFonts(family, weight, specs).find(x => x.covered.has(cp) && outlined(x)) ?? null;
    };
    const shapeIn = (f, text, weight) => {
        f.font.setVariations([new hb.Variation('wght', weight)]);
        const buf = new hb.Buffer();
        buf.addText(text);
        buf.guessSegmentProperties();
        hb.shape(f.font, buf);
        const pos = buf.getGlyphPositions();
        return buf.getGlyphInfos().map((g, i) => ({ id: g.codepoint, xAdvance: pos[i]?.xAdvance ?? 0, xOffset: pos[i]?.xOffset ?? 0, yOffset: pos[i]?.yOffset ?? 0 }));
    };
    return {
        shape(text, family, weight) {
            const primary = must(fontFor(family, weight, specs));
            const glyphs = [];
            // runs of characters that one font draws, as measureText splits them
            let run = '', runFont = primary;
            const flush = () => {
                if (!run)
                    return;
                const k = primary.upem / runFont.upem, slot = slotOf(runFont);
                for (const g of shapeIn(runFont, run, weight))
                    glyphs.push({ id: slot * 0x10000 + g.id, xAdvance: g.xAdvance * k, xOffset: g.xOffset * k, yOffset: g.yOffset * k });
                run = '';
            };
            for (const ch of text) {
                const f = fontOf(family, weight, must(ch.codePointAt(0))) ?? primary;
                if (f !== runFont) {
                    flush();
                    runFont = f;
                }
                run += ch;
            }
            flush();
            return { upem: primary.upem, glyphs };
        },
        path(id, family, weight) {
            const primary = must(fontFor(family, weight, specs)), f = must(slots[Math.floor(id / 0x10000)]);
            f.font.setVariations([new hb.Variation('wght', weight)]);
            const d = f.font.glyphToPath(id % 0x10000);
            if (f === primary || f.upem === primary.upem)
                return d;
            const k = primary.upem / f.upem;
            return d.replace(/-?\d*\.?\d+(?:e-?\d+)?/gi, v => String(Math.round(Number(v) * k * 100) / 100));
        },
        covers: (cp, family, weight) => fontOf(family, weight, cp) !== null,
    };
}
/** Every font file the slides of a project would be outlined with, or what is missing (ADR 0056 D2: `serve` stops at once rather than draw boxes). */
export function outlineFontCheck(specs) {
    if (!hasHarfbuzz)
        return { ok: false, missing: ['harfbuzzjs (npm install harfbuzzjs)'] };
    const files = new Set(), missing = [];
    for (const family of ['sans', 'mono'])
        for (const w of [400, 700]) {
            const f = fontFor(family, w, specs, false);
            if (f)
                files.add(f.file);
            else
                missing.push(`${w === 700 ? 'bold ' : ''}${family}`);
        }
    for (const w of [400, 700]) {
        const e = fontFor('emoji', w, specs, false);
        if (e)
            files.add(e.file);
    }
    return missing.length ? { ok: false, missing } : { ok: true, files: [...files] };
}

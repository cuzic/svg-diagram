// A text engine as a Worker builds one (HarfBuzz over the installed Japanese font), for the tests of the edge entries.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {harfbuzz, resolveFontFile} from '../../lib/font-metrics.ts';
import type {FontSpecs} from '../../lib/types/project.ts';
import type {TextEngine} from '../../lib/spec-edge.ts';

// The Japanese font a Worker bundles is Noto Sans JP, and the tests of what it lacks (Hangul, U+2212) are written for it. A machine
// without it would measure with the stack's sans-serif, a Latin font with no Japanese glyphs: so the engine and the Node path it is
// compared with both take Noto Sans JP (from SVG_DIAGRAM_JA_FONTS, or fontconfig), else the font fontconfig picks for Japanese.
const jaFile = (weight: number): string | undefined => {
  for (const pattern of [`Noto Sans JP:weight=${weight === 700 ? 200 : 80}`, `sans-serif:lang=ja:weight=${weight === 700 ? 200 : 80}`]) {
    const [file, index, family] = execFileSync('fc-match', ['-f', '%{file}\t%{index}\t%{family}', pattern], {encoding: 'utf8'}).split('\t');
    if (file && (pattern.startsWith('sans-serif') || family?.split(',').some(f => f.trim() === 'Noto Sans JP'))) return `${file}#${Number(index) & 0xffff}`;
  }
  return undefined;
};
// CI keeps the files out of fontconfig (the browser comparisons need its fonts as they are) and names their directory here
const dir = process.env.SVG_DIAGRAM_JA_FONTS;
const regular = dir ? `${dir}/NotoSansJP-Regular.otf` : jaFile(400), bold = dir ? `${dir}/NotoSansJP-Bold.otf` : jaFile(700);
/** The font files `realEngine` draws with, for `renderSpec(..., {config: {measure: 'font', fonts: JA_FONTS}})`. */
export const JA_FONTS: FontSpecs = regular && bold ? {sans: {regular, bold}} : {};

export function realEngine(): TextEngine {
  const hb = harfbuzz();
  const open = (weight: number) => {
    const r = resolveFontFile('sans', weight, JA_FONTS);
    assert.ok(r, 'a Japanese font must be installed for this test');
    const b = fs.readFileSync(r.file);
    const face = new hb.Face(new hb.Blob(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), r.index), font = new hb.Font(face), ext = font.hExtents();
    return {face, font, upem: face.upem, asc: ext.ascender, desc: ext.descender, covered: new Set(face.collectUnicodes())};
  };
  const fonts = {400: open(400), 700: open(700)};
  const of = (w: number) => w >= 600 ? fonts[700] : fonts[400];
  const shape = (text: string, weight: number) => {
    const f = of(weight), buf = new hb.Buffer();
    buf.addText(text); buf.guessSegmentProperties(); hb.shape(f.font, buf);
    const infos = buf.getGlyphInfos(), pos = buf.getGlyphPositions();
    return {upem: f.upem, glyphs: infos.map((g, i) => ({id: g.codepoint, xAdvance: pos[i]?.xAdvance ?? 0, xOffset: pos[i]?.xOffset ?? 0, yOffset: pos[i]?.yOffset ?? 0}))};
  };
  const width = (text: string, size: number, weight: number) => { const s = shape(text, weight); return s.glyphs.reduce((n, g) => n + g.xAdvance, 0) / s.upem * size; };
  return {
    measure: ({text, size, weight}) => { const f = of(weight); return {w: width(text, size, weight), h: Math.round((f.asc - f.desc) / f.upem * size)}; },
    textBox: (text, _family, size, weight) => { const f = of(weight); return {w: width(text, size, weight), ascent: f.asc / f.upem * size, descent: -f.desc / f.upem * size}; },
    font: {shape: (text, _f, weight) => shape(text, weight), path: (id, _f, weight) => of(weight).font.glyphToPath(id), covers: (cp, _f, weight) => of(weight).covered.has(cp)},
  };
}

// A text engine as a Worker builds one (HarfBuzz over the installed Japanese font), for the tests of the edge entries.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {harfbuzz, resolveFontFile} from '../../lib/font-metrics.ts';
import type {TextEngine} from '../../lib/spec-edge.ts';

export function realEngine(): TextEngine {
  const hb = harfbuzz();
  const open = (weight: number) => {
    const r = resolveFontFile('sans', weight);
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

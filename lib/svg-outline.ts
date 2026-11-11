// A drawn SVG with its text turned into outlines: the same picture on a machine that has none of the fonts it was measured with. The shapes come
// from a font the caller hands in (a port, as in ADR 0007), so nothing here reads a file: it runs in a browser or an edge worker as well.
import {computeStyles, elements, parseXml, textOf, type El, type Style} from './svg-dom.ts';
import {familyKind, placeRuns, type TextBoxFn} from './svg-geom.ts';
import type {FontFamily} from './types/core.ts';

export interface ShapedGlyph {id: number; xAdvance: number; xOffset: number; yOffset: number}
/** The font the outlines come from. `shape` and `path` are in font units; the path is SVG path data with y up, as a font has it. */
export interface OutlineFont {
  shape(text: string, family: FontFamily, weight: number): {upem: number; glyphs: ShapedGlyph[]};
  path(id: number, family: FontFamily, weight: number): string;
  covers(codePoint: number, family: FontFamily, weight: number): boolean;
}
export interface Outlined {
  svg: string;
  /** Characters the font has no glyph for, with the text they are in. Those draw as the font's empty-box glyph. */
  missing: {text: string; char: string}[];
  /** What a <text> asked for that outlines here do not reproduce. */
  unsupported: string[];
}

const NOT_REPRODUCED = ['writing-mode', 'textLength', 'lengthAdjust', 'letter-spacing', 'word-spacing', 'dominant-baseline', 'alignment-baseline', 'baseline-shift', 'text-decoration', 'rotate', 'font-style', 'font-variant', 'paint-order', 'visibility', 'clip-path', 'mask', 'filter'];
/** The same properties written as CSS, in a style="" or a <style> rule. */
const NOT_REPRODUCED_CSS = new RegExp(`(?:^|[;{\\s])(${NOT_REPRODUCED.join('|')})\\s*:`, 'g');
/** Spaces, joiners, direction marks and variation selectors draw nothing of their own, and no font needs to list them for the text to be right. */
const INVISIBLE = /\s|\p{Default_Ignorable_Code_Point}/u;
const n = (v: number) => String(Math.round(v * 100) / 100);
const scaleOf = (v: number) => String(Math.round(v * 1e6) / 1e6);
const attr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const GLYPH_PREFIX = 'sd-glyph-';

function groupOpen(el: El, style: Style, label: string): string {
  const raw = (k: string) => el.attrs[k] === undefined ? '' : ` ${k}="${attr(el.attrs[k] as string)}"`;
  const fillOpacity = style.fillOpacity < 1 ? ` fill-opacity="${style.fillOpacity}"` : '';
  const opacity = style.opacity < 1 ? ` opacity="${style.opacity}"` : '';
  return `<g fill="${attr(style.fill)}"${fillOpacity}${opacity}${raw('transform')} role="img" aria-label="${attr(label)}">`;
}

/** What `css` asks for that outlines do not reproduce. */
const unsupportedIn = (css: string): string[] => [...css.matchAll(NOT_REPRODUCED_CSS)].map(m => m[1] as string);

/** `svg` with every <text> replaced by outlines of its glyphs. A glyph used twice is defined once. */
export function outlineText(svg: string, font: OutlineFont, measure: TextBoxFn): Outlined {
  const root = parseXml(svg);
  const styles = computeStyles(root);
  const texts = elements(root).filter(e => e.tag === 'text');
  const spans = [...svg.matchAll(/<text\b[^>]*?(?:\/>|>[\s\S]*?<\/text>)/g)];
  if (spans.length !== texts.length) throw new Error(`outlineText: found ${spans.length} <text> in the markup and ${texts.length} in the parsed SVG`);
  const defs = new Map<string, string>();
  const missing: Outlined['missing'] = [];
  const unsupported = new Set<string>();
  for (const st of elements(root).filter(e => e.tag === 'style')) for (const k of unsupportedIn(textOf(st))) unsupported.add(k);
  const replacement = texts.map(text => {
    for (const e of elements(text)) {
      for (const k of NOT_REPRODUCED) if (e.attrs[k] !== undefined) unsupported.add(k);
      for (const k of unsupportedIn(e.attrs['style'] ?? '')) unsupported.add(k);
      const st = styles.get(e) as Style;
      if (st.stroke !== 'none') unsupported.add('stroke');
    }
    let uses = '', label = '';
    const own = styles.get(text) as Style;
    for (const run of placeRuns(text, styles, measure)) {
      const family = familyKind(run.style.fontFamily), weight = run.style.fontWeight;
      for (const ch of run.s) {
        if (!INVISIBLE.test(ch) && !font.covers(ch.codePointAt(0) as number, family, weight)) missing.push({text: run.s, char: ch});
      }
      const {upem, glyphs} = font.shape(run.s, family, weight);
      const k = run.style.fontSize / upem;
      let x = run.x;
      label += run.s;
      // a tspan in its own colour keeps it; the others take the colour of the group
      const recoloured = run.style.fill !== own.fill || run.style.fillOpacity !== own.fillOpacity;
      if (recoloured) uses += `<g fill="${attr(run.style.fill)}"${run.style.fillOpacity < 1 ? ` fill-opacity="${run.style.fillOpacity}"` : ''}>`;
      for (const g of glyphs) {
        const key = `${family[0]}${weight >= 600 ? 'b' : 'r'}${g.id}`;
        if (!defs.has(key)) defs.set(key, font.path(g.id, family, weight));
        if (defs.get(key)) uses += `<use href="#${GLYPH_PREFIX}${key}" transform="translate(${n(x + g.xOffset * k)} ${n(run.y - g.yOffset * k)}) scale(${scaleOf(k)} ${scaleOf(-k)})"/>`;
        x += g.xAdvance * k;
      }
      if (recoloured) uses += '</g>';
    }
    return `${groupOpen(text, styles.get(text) as Style, label)}${uses}</g>`;
  });
  let i = 0;
  const body = svg.replace(/<text\b[^>]*?(?:\/>|>[\s\S]*?<\/text>)/g, () => replacement[i++] as string)
    .replace(/<style>([\s\S]*?)<\/style>/g, (_, css: string) => `<style>${css.replace(/\s*(?:text|\.emoji)\s*\{[^{}]*font-family[^{}]*\}/g, '')}</style>`) // no text is left for the font rules to apply to
    .replace(/\s*<style>\s*<\/style>/g, '');
  const glyphs = [...defs].filter(([, d]) => d).map(([key, d]) => `<path id="${GLYPH_PREFIX}${key}" d="${d}"/>`).join('');
  return {svg: glyphs ? body.replace(/<svg\b[^>]*>/, m => `${m}<defs>${glyphs}</defs>`) : body, missing, unsupported: [...unsupported]};
}

// A drawn SVG with its text turned into outlines: the same picture on a machine that has none of the fonts it was measured with. The shapes come
// from a font the caller hands in (a port, as in ADR 0007), so nothing here reads a file: it runs in a browser or an edge worker as well.
import {computeStyles, elements, parseXml, textOf, type El, type Style} from './svg-dom.ts';
import {familyKind, placeRuns, type TextBoxFn} from './svg-geom.ts';
import type {FontFamily} from './types/core.ts';
import {EMOJI_EM, emojiParts} from './emoji-edge.ts';

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

const NOT_REPRODUCED = ['writing-mode', 'textLength', 'lengthAdjust', 'letter-spacing', 'word-spacing', 'dominant-baseline', 'alignment-baseline', 'baseline-shift', 'text-decoration', 'rotate', 'font-style', 'font-variant', 'visibility', 'clip-path', 'mask', 'filter'];
/** The same properties written as CSS, in a style="" or a <style> rule. */
const NOT_REPRODUCED_CSS = new RegExp(`(?:^|[;{\\s])(${NOT_REPRODUCED.join('|')})\\s*:`, 'g');
/** Spaces, joiners, direction marks and variation selectors draw nothing of their own, and no font needs to list them for the text to be right. */
const INVISIBLE = /\s|\p{Default_Ignorable_Code_Point}/u;
const n = (v: number) => String(Math.round(v * 100) / 100);
const scaleOf = (v: number) => String(Math.round(v * 1e6) / 1e6);
const attr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const GLYPH_PREFIX = 'sd-glyph-';

/** What a <text> may carry that its outline group takes over as it is: the group has the same transform, so these apply to the same place. */
const OWN_ON_TEXT = ['clip-path', 'mask', 'filter'];

/** Whether a paint-order draws the stroke before the fill (`stroke`, `stroke fill`, `markers stroke`: the first of fill / stroke named is the stroke). */
const strokeFirst = (paintOrder: string | undefined): boolean => {
  const first = (paintOrder ?? '').split(/\s+/).find(t => t === 'fill' || t === 'stroke');
  return first === 'stroke';
};

/** A paint server (a gradient) is read in the user space of the element that uses it: glyphs drawn through a scaled <use> would read it in font units. */
const isPaintServer = (paint: string): boolean => /^\s*url\(/.test(paint);

/** The stroke of a run as attributes of the group round its glyphs. A glyph is the font's units scaled by `k`, so the width is divided by `k`. */
function strokeAttrs(style: Style, k: number, twoPass: boolean): string {
  if (style.stroke === 'none') return '';
  const o = [`stroke="${attr(style.stroke)}"`, `stroke-width="${scaleOf(style.strokeWidth / k)}"`];
  if (style.strokeOpacity < 1) o.push(`stroke-opacity="${style.strokeOpacity}"`);
  if (style.strokeLinejoin) o.push(`stroke-linejoin="${attr(style.strokeLinejoin)}"`);
  if (style.strokeLinecap) o.push(`stroke-linecap="${attr(style.strokeLinecap)}"`);
  if (style.strokeMiterlimit) o.push(`stroke-miterlimit="${attr(style.strokeMiterlimit)}"`);
  // a stroke drawn first is a pass of its own (all letters' strokes, then all fills), as a browser draws a text chunk
  if (twoPass) o.push('fill="none"');
  else if (style.paintOrder && style.paintOrder !== 'normal') o.push(`paint-order="${attr(style.paintOrder)}"`);
  return ` ${o.join(' ')}`;
}

type Pt = [number, number];
/** A font's glyph path (absolute M L Q C Z, y up) placed at (tx, ty) at scale k with y down: the same shape in the text's own user space. */
function placedPath(d: string, k: number, tx: number, ty: number): string {
  const toks = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? [];
  const arity: Record<string, number> = {M: 1, L: 1, Q: 2, C: 3, Z: 0};
  let out = '', i = 0, cmd = '';
  const pt = (): Pt => { const x = Number(toks[i++]), y = Number(toks[i++]); return [Math.round((tx + x * k) * 100) / 100, Math.round((ty - y * k) * 100) / 100]; };
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i] as string)) cmd = (toks[i++] as string).toUpperCase();
    if (!(cmd in arity)) throw new Error(`outlineText: unsupported glyph path command "${cmd}"`);
    out += cmd;
    for (let j = 0; j < (arity[cmd] as number); j++) out += (j ? ' ' : '') + pt().join(',');
    if (cmd === 'M') cmd = 'L';
  }
  return out;
}

function groupOpen(el: El, style: Style, label: string, inheritedStroke: boolean): string {
  const raw = (k: string) => el.attrs[k] === undefined ? '' : ` ${k}="${attr(el.attrs[k] as string)}"`;
  const fillOpacity = style.fillOpacity < 1 ? ` fill-opacity="${style.fillOpacity}"` : '';
  const opacity = style.opacity < 1 ? ` opacity="${style.opacity}"` : '';
  return `<g fill="${attr(style.fill)}"${inheritedStroke ? ' stroke="none"' : ''}${fillOpacity}${opacity}${raw('transform')}${OWN_ON_TEXT.map(raw).join('')} role="img" aria-label="${attr(label)}">`;
}

/** What `css` asks for that outlines do not reproduce. */
const unsupportedIn = (css: string): string[] => [...css.matchAll(NOT_REPRODUCED_CSS)].map(m => m[1] as string);

/** The fonts a live emoji is drawn with: the viewer's own. */
const EMOJI_FONTS = 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif';

/**
 * `svg` with every <text> replaced by outlines of its glyphs. A glyph used twice is defined once. `liveEmoji`: an emoji the font has no
 * glyph for stays text (in the viewer's emoji font, EMOJI_EM of its size wide: measure with emojiTextBox), and is not missing.
 */
export function outlineText(svg: string, font: OutlineFont, measure: TextBoxFn, opts: {liveEmoji?: boolean} = {}): Outlined {
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
      for (const k of NOT_REPRODUCED) if (e.attrs[k] !== undefined && !(e === text && OWN_ON_TEXT.includes(k))) unsupported.add(k);
      for (const k of unsupportedIn(e.attrs['style'] ?? '')) unsupported.add(k);
    }
    let strokes = '', uses = '', label = '';
    const own = styles.get(text) as Style;
    for (const e of elements(text)) {
      const st = styles.get(e) as Style;
      if (st.stroke !== 'none') for (const [k, v] of [['stroke-dasharray', st.strokeDasharray], ['stroke-dashoffset', st.strokeDashoffset]] as const) if (v !== undefined && v !== 'none' && !/^0(?:px)?$/.test(v)) unsupported.add(k);
    }
    for (const run of placeRuns(text, styles, measure)) {
      const family = familyKind(run.style.fontFamily), weight = run.style.fontWeight;
      let x = run.x, fills = '';
      label += run.s;
      const twoPass = run.style.stroke !== 'none' && strokeFirst(run.style.paintOrder);
      // a tspan in its own colour keeps it; the others take the colour of the group
      const recoloured = run.style.fill !== own.fill || run.style.fillOpacity !== own.fillOpacity;
      const baked = isPaintServer(run.style.fill) || isPaintServer(run.style.stroke);
      for (const part of opts.liveEmoji ? emojiParts(run.s, cp => font.covers(cp, family, weight)) : [{s: run.s, emoji: false}]) {
        if (part.emoji) {
          // the viewer's emoji font draws it, at the width it was measured with
          fills += `<text x="${n(x)}" y="${n(run.y)}" font-size="${n(run.style.fontSize)}" font-family="${EMOJI_FONTS}">${attr(part.s)}</text>`;
          x += run.style.fontSize * EMOJI_EM;
          continue;
        }
        for (const ch of part.s) {
          if (!INVISIBLE.test(ch) && !font.covers(ch.codePointAt(0) as number, family, weight)) missing.push({text: run.s, char: ch});
        }
        const {upem, glyphs} = font.shape(part.s, family, weight);
        const k = run.style.fontSize / upem;
        let els = '';
        for (const g of glyphs) {
          const key = `${family[0]}${weight >= 600 ? 'b' : 'r'}${g.id}`;
          if (!defs.has(key)) defs.set(key, font.path(g.id, family, weight));
          const d = defs.get(key);
          const gx = x + g.xOffset * k, gy = run.y - g.yOffset * k;
          // a gradient fill or stroke is read in the user space of the shape it paints: draw those glyphs as paths in the text's own space
          if (d) els += baked ? `<path d="${placedPath(d, k, gx, gy)}"/>` : `<use href="#${GLYPH_PREFIX}${key}" transform="translate(${n(gx)} ${n(gy)}) scale(${scaleOf(k)} ${scaleOf(-k)})"/>`;
          x += g.xAdvance * k;
        }
        const stroke = strokeAttrs(run.style, baked ? 1 : k, twoPass);
        if (twoPass) { strokes += `<g${stroke}>${els}</g>`; fills += els; }
        else fills += stroke ? `<g${stroke}>${els}</g>` : els;
      }
      uses += recoloured ? `<g fill="${attr(run.style.fill)}"${run.style.fillOpacity < 1 ? ` fill-opacity="${run.style.fillOpacity}"` : ''}>${fills}</g>` : fills;
    }
    uses = strokes + uses;
    return `${groupOpen(text, styles.get(text) as Style, label, !!text.parent && (styles.get(text.parent) as Style).stroke !== 'none')}${uses}</g>`;
  });
  let i = 0;
  const body = svg.replace(/<text\b[^>]*?(?:\/>|>[\s\S]*?<\/text>)/g, () => replacement[i++] as string)
    .replace(/<style>([\s\S]*?)<\/style>/g, (_, css: string) => `<style>${css.replace(/\s*(?:text|\.emoji)\s*\{[^{}]*font-family[^{}]*\}/g, '')}</style>`) // no text is left for the font rules to apply to
    .replace(/\s*<style>\s*<\/style>/g, '');
  const glyphs = [...defs].filter(([, d]) => d).map(([key, d]) => `<path id="${GLYPH_PREFIX}${key}" d="${d}"/>`).join('');
  return {svg: glyphs ? body.replace(/<svg\b[^>]*>/, m => `${m}<defs>${glyphs}</defs>`) : body, missing, unsupported: [...unsupported]};
}

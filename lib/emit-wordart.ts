import {snap4, emojiSpan} from './emit-common.ts';
import {colorOf} from './tokens.ts';
import {figureTransform, gradientOf, paintLayers, translateItem} from './wordart.ts';
import type {ArtItem, LaidOutWordArt} from './wordart.ts';
import type {Rect, Theme} from './types/core.ts';

// wordart(): the plate, then the layers from the bottom up (paintLayers: mirror image, shadow, glow, depth, outer outlines, bevel) and the
// text itself on top. Every layer but the last is a copy of the text marked aria-hidden (decoration: read aloud and linted once).
export function renderWordArt(band: LaidOutWordArt, day: Theme, dim = false): string {
  const parts: string[] = [], {look} = band, f = (n: number): number => Math.round(n * 10) / 10;
  const snapped = (r: Rect): string => `x="${snap4(r.x)}" y="${snap4(r.y)}" width="${snap4(r.x + r.w) - snap4(r.x)}" height="${snap4(r.y + r.h) - snap4(r.y)}"`;
  const g = dim ? undefined : gradientOf(band, day), defs = [
    ...(g ? [`<linearGradient id="${g.id}" gradientUnits="userSpaceOnUse" x1="${f(g.x1)}" y1="${f(g.y1)}" x2="${f(g.x2)}" y2="${f(g.y2)}"><stop offset="0" stop-color="${g.from}"/><stop offset="1" stop-color="${g.to}"/></linearGradient>`] : []),
    ...(band.reflection && !dim ? [`<clipPath id="${band.uid}-c"><rect ${snapped(band.reflection.clip)}/></clipPath>`] : []),
  ];
  if (defs.length) parts.push(`<defs>${defs.join('')}</defs>`);
  const figure = figureTransform(band);
  // (a plate is part of the figure: it turns and flips with the letters; a dimmed wordart has none)
  if (band.plate && !dim) parts.push(`<rect ${snapped(band.plate)} rx="${Math.round(band.size * 0.15)}" fill="${colorOf(look.plate!, day)}"${figure ? ` transform="${figure}"` : ''}/>`);
  for (const p of paintLayers(band, day, dim)) {
    const stroke = p.stroke ? ` stroke="${p.stroke}" stroke-width="${p.sw}" stroke-linejoin="round"${p.text && p.fill !== 'none' ? ' paint-order="stroke"' : ''}` : '';
    const paint = `fill="${p.fill}"${stroke}${p.opacity !== undefined ? ` opacity="${p.opacity}"` : ''}${p.hidden ? ' aria-hidden="true" data-decor=""' : ''}${p.mirror ? ` clip-path="url(#${band.uid}-c)"` : ''}`;
    // a mirror image is flipped about the axis and pushed down by the gap; the figure's own turn / flip comes first in the list
    const mirror = p.mirror && band.reflection ? `matrix(1 0 0 -1 0 ${f(2 * band.reflection.axis + look.reflection!.gap)})` : '';
    const tf = [figure, mirror].filter(Boolean).join(' ');
    parts.push(band.items.map(it => wordArtItem(translateItem(it, p.dx, p.dy), band, paint, tf)).join('\n  '));
  }
  return parts.join('\n  ');
}

// `tf`: the transform every text of the figure carries (a <g transform> would be flagged by lint-svg: the offset is baked into each child)
function wordArtItem(it: ArtItem, band: LaidOutWordArt, paint: string, tf: string): string {
  const {weight, spacing, font} = band.look, f = (n: number): number => Math.round(n * 10) / 10;
  const xf = (own = ''): string => { const t = [tf, own].filter(Boolean).join(' '); return t ? ` transform="${t}"` : ''; };
  const head = (size: number): string => `${font === 'mono' ? ' class="mono"' : ''} font-size="${size}"${weight === 400 ? '' : ` font-weight="${weight}"`} ${paint}`;
  const at = (x: number, y: number): string => `x="${f(x)}" y="${f(y)}"`;
  const tspans = (glyphs: {ch: string; x: number; y: number}[], extra: (g: never) => string): string => glyphs.map(g => `<tspan ${at(g.x, g.y)}${extra(g as never)}>${emojiSpan(g.ch)}</tspan>`).join('');
  switch (it.k) {
    case 'line': return `<text ${at(it.x, it.y)}${it.anchor === 'start' ? '' : ` text-anchor="${it.anchor}"`}${spacing ? ` letter-spacing="${spacing}"` : ''}${xf()}${head(it.size)}>${emojiSpan(it.text)}</text>`;
    case 'rot': return `<text ${at(it.x, it.y)} text-anchor="middle"${xf(`rotate(90 ${f(it.cx)} ${f(it.cy)})`)}${head(it.size)}>${emojiSpan(it.text)}</text>`;
    case 'arc': return `<text ${at(it.glyphs[0].x, it.glyphs[0].y)}${xf()}${head(it.size)}>${tspans(it.glyphs, (g: {rot: number}) => ` rotate="${f(g.rot)}"`)}</text>`;
    case 'col': return `<text ${at(it.glyphs[0].x, it.glyphs[0].y)} text-anchor="middle"${xf()}${head(it.size)}>${tspans(it.glyphs, (g: {size: number}) => g.size === it.size ? '' : ` font-size="${g.size}"`)}</text>`;
  }
}

import {emitSvg} from '../emit.ts';
import {prefixSvgIds} from '../svg-ids.ts';
import type {LaidOutDiagram, LaidOutBand} from '../types/index.ts';
import type {Rect} from './xml.ts';

const INK_PAD = 12; // the band's rectangle plus this much on every side (until the ink extent is measured)

/** One band drawn on its own: `svg` is what `svgBlip` carries, `pngSvg` the twin resvg can draw (it ignores `auto-start-reverse`). */
export interface Picture {svg: string; pngSvg: string}

/** resvg ignores `orient="auto-start-reverse"`: give each such marker a rotated twin for the start end. */
function resvgMarkers(svg: string): string {
  const copies: string[] = [];
  let out = svg.replace(/<marker\b([^>]*\bid="([^"]+)"[^>]*)orient="auto-start-reverse"([^>]*)>([\s\S]*?)<\/marker>/g, (_m, a: string, id: string, z: string, body: string) => {
    copies.push(`<marker${a.replace(`id="${id}"`, `id="${id}-start"`)}orient="auto"${z}><g transform="rotate(180 5 5)">${body}</g></marker>`);
    return `<marker${a}orient="auto"${z}>${body}</marker>`;
  });
  if (copies.length) out = out.replace('</defs>', copies.join('') + '</defs>').replace(/marker-start="url\(#([^)]+)\)"/g, 'marker-start="url(#$1-start)"');
  return out;
}

/** The picture of a band and the rectangle it covers on the slide. */
export function bandPicture(ld: LaidOutDiagram, band: LaidOutBand & {h: number}, index: number): {picture: Picture; rect: Rect} {
  const x = Math.max(0, band.x - INK_PAD), y = Math.max(0, band.y - INK_PAD);
  const w = Math.min(ld.width, band.x + band.w + INK_PAD) - x, bh = Math.min(ld.canvasHeight, band.y + band.h + INK_PAD) - y;
  let svg = emitSvg({...ld, transparent: true, laidOut: [band], connects: []}, {noRecolor: false});
  svg = svg.replace(/width="[^"]+" height="[^"]+" viewBox="[^"]+"/, `width="${w}" height="${bh}" viewBox="${x} ${y} ${w} ${bh}"`);
  svg = prefixSvgIds(svg, `pptx-band-${index}`);
  return {picture: {svg, pngSvg: resvgMarkers(svg)}, rect: {x, y, w, h: bh}};
}

import {Resvg} from '@resvg/resvg-js';
import {emitSvg} from '../emit.ts';
import {prefixSvgIds} from '../svg-ids.ts';
import type {LaidOutDiagram, LaidOutBand} from '../types/index.ts';
import type {Rect} from './xml.ts';

const INK_PAD = 12; // the band's rectangle plus this much on every side (until the ink extent is measured)

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

export interface BandImage extends Rect {svg: string; pngSvg: string}

/** One band drawn on its own as an SVG (for `svgBlip`) and its resvg-ready twin (for the PNG fallback). */
export function bandImage(ld: LaidOutDiagram, band: LaidOutBand, index: number): BandImage {
  const h = 'h' in band ? band.h : Math.max(...band.children.map(c => c.y + c.h)) - band.y;
  const x = Math.max(0, band.x - INK_PAD), y = Math.max(0, band.y - INK_PAD);
  const w = Math.min(ld.width, band.x + band.w + INK_PAD) - x, bh = Math.min(ld.canvasHeight, band.y + h + INK_PAD) - y;
  let svg = emitSvg({...ld, transparent: true, laidOut: [band], connects: []}, {noRecolor: false});
  svg = svg.replace(/width="[^"]+" height="[^"]+" viewBox="[^"]+"/, `width="${w}" height="${bh}" viewBox="${x} ${y} ${w} ${bh}"`);
  svg = prefixSvgIds(svg, `pptx-band-${index}`);
  return {svg, pngSvg: resvgMarkers(svg), x, y, w, h: bh};
}

export function rasterize(pngSvg: string, fontFiles: string[], scale: number): Buffer {
  const font = fontFiles.length ? {loadSystemFonts: false, fontFiles} : {loadSystemFonts: true};
  return Buffer.from(new Resvg(pngSvg, {font, fitTo: {mode: 'zoom', value: scale}}).render().asPng());
}

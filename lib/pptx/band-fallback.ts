import {recolor} from '../tokens.ts';
import type {LaidOutBand} from '../types/index.ts';
import {register, type Ctx} from './adapter.ts';
import type {bandPicture} from './image-band-core.ts';
import {imageRids} from './package.ts';
import {namedAs} from './prims.ts';
import {anchorXml, groupXml, picXml} from './shapes.ts';
import type {svgShapesXml} from './svg-shapes.ts';

/** A band's group: its type, numbered from the second of that type on the slide (`chart`, `chart 2`), and its DSL id (ADR 0054 D7). */
function bandName(ctx: Ctx, type: string, dslId?: string): string {
  const n = (ctx.count.get(type) ?? 0) + 1;
  ctx.count.set(type, n);
  return namedAs(n > 1 ? `${type} ${n}` : type, '', dslId);
}

/** Use editable shapes when the supplied converter can read the SVG, or embed it with a PNG fallback. */
export function drawBandFallback(
  band: LaidOutBand, ctx: Ctx, index: number, getPicture: () => ReturnType<typeof bandPicture>,
  convert?: typeof svgShapesXml, onPicture?: () => void,
): string {
  const fallback = convert ? getPicture() : undefined;
  const shapes = fallback && convert ? convert(fallback.picture.svg, ctx.fonts, ctx.next) : null;
  const id = 'id' in band ? band.id : undefined;
  let drawn: string;
  if (shapes !== null && fallback) {
    drawn = groupXml(ctx.next(), bandName(ctx, band.type, id), fallback.rect, shapes);
  } else {
    onPicture?.();
    const {picture, rect} = fallback ?? getPicture();
    const rids = imageRids(ctx.pictures.length);
    const paint = (svg: string) => recolor(ctx.tones, svg, ctx.ld.appearance);
    ctx.pictures.push({svg: paint(picture.svg), pngSvg: paint(picture.pngSvg)});
    drawn = picXml(ctx.next(), `${band.type}-${index}`, rect, rids.png, rids.svg);
  }
  if (!id || !('h' in band)) return drawn;
  const anchor = {x: band.x, y: band.y, w: band.w, h: band.h}, anchorId = ctx.next();
  register(ctx, id, anchorId, anchor);
  return drawn + anchorXml(anchorId, `anchor-${id}`, anchor);
}

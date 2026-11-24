import {prepareBands} from '../core.ts';
import {visibleAt} from '../reveal-visibility.ts';
import {recolor} from '../tokens.ts';
import type {LaidOutBand} from '../types/index.ts';
import {register} from './adapter.ts';
import type {PptxAdapter, PptxBands} from './adapter.ts';
import {bandPicture} from './image-band-core.ts';
import {imageRids, packageEntries} from './package.ts';
import {anchorXml, picXml} from './shapes.ts';
import {fontsOf, planSlideWith} from './slide-core.ts';
import {zipEntries} from './zip.ts';

export type {PptxBands} from './adapter.ts';

type PptxOptions = Parameters<typeof prepareBands>[1] & {
  bands?: PptxBands;
  strict?: boolean;
  font?: string;
  pngScale?: number;
  rasterize?: (svg: string, scale: number) => Uint8Array | Promise<Uint8Array>;
  outline?: (svg: string) => string;
};

/** Render selected bands as an editable slide, reporting the bands embedded as pictures. */
export async function renderBandsPptx(bands: Parameters<typeof prepareBands>[0], opts: PptxOptions) {
  const {placed, stage, verdict, emit} = await prepareBands(bands, opts);
  const pngScale = opts.pngScale ?? 2;
  if (!(Number.isFinite(pngScale) && pngScale > 0)) throw new Error('renderBandsPptx: pngScale must be a positive number');
  const fallbacks: {type: string; id?: string}[] = [];
  const visible = placed.laidOut.map(item => visibleAt(item, stage));
  const laidOut = placed.laidOut.flatMap((item, index) => {
    if (!visible[index]) return [];
    if (item.type !== 'group' && item.type !== 'swimlane' || !item.span) return [item];
    const span = visible.slice(index + 1, index + 1 + item.span).filter(Boolean).length;
    return [{...item, span}];
  });
  const ld = {...placed, laidOut, connects: placed.connects.filter(item => visibleAt(item, stage))};
  const plan = planSlideWith(ld, fontsOf(opts.font), (item, ctx, index) => {
    // The table key selects an adapter expecting this exact band type.
    const adapter = opts.bands?.[item.type] as PptxAdapter<LaidOutBand> | undefined;
    const native = adapter?.(item, ctx, index);
    if (native !== undefined) return native;
    const id = 'id' in item ? item.id : undefined;
    fallbacks.push({type: item.type, ...(id ? {id} : {})});
    if (opts.strict) throw new Error(`renderBandsPptx: picture fallback for ${item.type}${id ? ` "${id}"` : ''}`);
    const {rect, picture} = bandPicture(ld, item, index, figure => emit(figure, true));
    const rid = imageRids(ctx.pictures.length);
    const paint = (svg: string) => recolor(ctx.tones, svg, ld.appearance);
    ctx.pictures.push({svg: paint(picture.svg), pngSvg: paint(picture.pngSvg)});
    const drawn = picXml(ctx.next(), `${item.type}-${index}`, rect, rid.png, rid.svg);
    if (!id || !('h' in item)) return drawn;
    const anchor = {x: item.x, y: item.y, w: item.w, h: item.h}, anchorId = ctx.next();
    register(ctx, id, anchorId, anchor);
    return drawn + anchorXml(anchorId, `anchor-${id}`, anchor);
  }, {title: opts.title, stage});
  const pngs: Uint8Array[] = [];
  for (const picture of plan.pictures) {
    if (!opts.rasterize) throw new Error('renderBandsPptx: pass rasterize to embed picture fallbacks');
    if (opts.outline) {
      picture.svg = opts.outline(picture.svg);
      picture.pngSvg = opts.outline(picture.pngSvg);
    }
    pngs.push(await opts.rasterize(picture.pngSvg, pngScale));
  }
  return {pptx: zipEntries(packageEntries(plan, pngs)), width: ld.width, height: ld.canvasHeight, fallbacks, verdict};
}

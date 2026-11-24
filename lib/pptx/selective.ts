import {withParts} from '../parts.ts';
import {prepareBands} from '../core.ts';
import {visibleAt} from '../reveal-visibility.ts';
import type {LaidOutBand} from '../types/index.ts';
import type {PptxAdapter, PptxBands, PptxSpans} from './adapter.ts';
import {drawBandFallback} from './band-fallback.ts';
import type {svgShapesXml} from './svg-shapes.ts';
import {bandPicture} from './image-band-core.ts';
import {packageEntries} from './package.ts';
import {fontsOf, planSlideWith} from './slide-core.ts';
import {zipEntries} from './zip.ts';

export type {PptxBands, PptxSpans} from './adapter.ts';

type Prepared = Awaited<ReturnType<typeof prepareBands>>;
type PptxOptions = Parameters<typeof prepareBands>[1] & SelectiveSlideOptions & {
  pngScale?: number;
  rasterize?: (svg: string, scale: number) => Uint8Array | Promise<Uint8Array>;
  outline?: (svg: string) => string;
};

export interface SelectiveSlideOptions {
  bands?: PptxBands;
  spans?: PptxSpans;
  strict?: boolean;
  svgShapes?: typeof svgShapesXml;
  font?: string;
  title?: string;
}

export function planPreparedPptx({placed, stage, emit}: Prepared, opts: SelectiveSlideOptions) {
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
    return drawBandFallback(item, ctx, index, () => bandPicture(ld, item, index, figure => emit(opts.svgShapes ? withParts(figure) : figure, true)), opts.svgShapes, () => {
      fallbacks.push({type: item.type, ...(id ? {id} : {})});
      if (opts.strict) throw new Error(`renderBandsPptx: picture fallback for ${item.type}${id ? ` "${id}"` : ''}`);
    });
  }, {title: opts.title, stage, spans: opts.spans});
  return {plan, fallbacks, width: ld.width, height: ld.canvasHeight, native: laidOut.length - plan.pictures.length};
}

/** Render selected bands as an editable slide, reporting the bands embedded as pictures. */
export async function renderBandsPptx(bands: Parameters<typeof prepareBands>[0], opts: PptxOptions) {
  const prepared = await prepareBands(bands, opts);
  const pngScale = opts.pngScale ?? 2;
  if (!(Number.isFinite(pngScale) && pngScale > 0)) throw new Error('renderBandsPptx: pngScale must be a positive number');
  const {plan, width, height, fallbacks} = planPreparedPptx(prepared, opts);
  const pngs: Uint8Array[] = [];
  for (const picture of plan.pictures) {
    if (!opts.rasterize) throw new Error('renderBandsPptx: pass rasterize to embed picture fallbacks');
    if (opts.outline) {
      picture.svg = opts.outline(picture.svg);
      picture.pngSvg = opts.outline(picture.pngSvg);
    }
    pngs.push(await opts.rasterize(picture.pngSvg, pngScale));
  }
  return {pptx: zipEntries(packageEntries(plan, pngs)), width, height, fallbacks, verdict: prepared.verdict};
}

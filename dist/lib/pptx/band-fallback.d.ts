import type { LaidOutBand } from '../types/index.ts';
import { type Ctx } from './adapter.ts';
import type { bandPicture } from './image-band-core.ts';
import type { svgShapesXml } from './svg-shapes.ts';
/** Use editable shapes when the supplied converter can read the SVG, or embed it with a PNG fallback. */
export declare function drawBandFallback(band: LaidOutBand, ctx: Ctx, index: number, getPicture: () => ReturnType<typeof bandPicture>, convert?: typeof svgShapesXml, onPicture?: () => void): string;

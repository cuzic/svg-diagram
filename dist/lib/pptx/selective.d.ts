import { prepareBands } from '../core.ts';
import type { PptxBands, PptxSpans } from './adapter.ts';
import type { svgShapesXml } from './svg-shapes.ts';
export type { PptxBands, PptxSpans } from './adapter.ts';
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
export declare function planPreparedPptx({ placed, stage, emit }: Prepared, opts: SelectiveSlideOptions): {
    plan: import("./package.ts").SlidePlan;
    fallbacks: {
        type: string;
        id?: string;
    }[];
    width: number;
    height: number;
    native: number;
};
/** Render selected bands as an editable slide, reporting the bands embedded as pictures. */
export declare function renderBandsPptx(bands: Parameters<typeof prepareBands>[0], opts: PptxOptions): Promise<{
    pptx: Uint8Array<ArrayBufferLike>;
    width: number;
    height: number;
    fallbacks: {
        type: string;
        id?: string;
    }[];
    verdict: import("../types/verdicts.ts").Verdict;
}>;

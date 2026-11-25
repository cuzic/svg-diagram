import type { LaidOutDiagram } from '../types/index.ts';
import { type Fonts } from './xml.ts';
import type { BandXml, PptxSpans } from './adapter.ts';
import type { LaidOutBand } from '../types/index.ts';
import type { SlidePlan } from './package.ts';
/** The typefaces written into the runs: `font` (if given) for everything, else the defaults. */
export declare const fontsOf: (font?: string) => Fonts;
export declare function planSlideWith(ld: LaidOutDiagram, fonts: Fonts, bandXml: BandXml<LaidOutBand>, { title, desc, stage, spans }?: {
    title?: string;
    desc?: string;
    stage?: number;
    spans?: PptxSpans;
}): SlidePlan;

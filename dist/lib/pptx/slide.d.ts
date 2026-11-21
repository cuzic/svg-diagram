import type { LaidOutDiagram } from '../types/index.ts';
import { type Fonts } from './xml.ts';
import type { SlidePlan } from './package.ts';
/** The typefaces written into the runs: `font` (if given) for everything, else the defaults. */
export declare const fontsOf: (font?: string) => Fonts;
export declare function planSlide(ld: LaidOutDiagram, fonts: Fonts): SlidePlan;

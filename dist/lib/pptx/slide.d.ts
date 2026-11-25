import type { LaidOutDiagram } from '../types/index.ts';
import type { SlidePlan } from './package.ts';
import type { Fonts } from './xml.ts';
export { fontsOf } from './slide-core.ts';
export declare function planSlide(ld: LaidOutDiagram, fonts: Fonts): SlidePlan;

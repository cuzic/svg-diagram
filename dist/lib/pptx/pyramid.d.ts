import type { LaidOutPyramid } from '../types/figures.ts';
import type { LaidOutDiagram } from '../types/index.ts';
import type { Fonts } from './xml.ts';
/** A pyramid: each layer a trapezoid in the accent colour at its opacity, holding its lines. */
export declare function pyramidXml(b: LaidOutPyramid, ld: LaidOutDiagram, fonts: Fonts, next: () => number): string;

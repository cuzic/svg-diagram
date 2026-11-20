import { type ToneEnv } from '../tokens.ts';
import type { LaidOutDiagram } from '../types/index.ts';
import type { LaidOutLegend } from '../types/containers.ts';
import type { Fonts } from './xml.ts';
/** Whether every item has a native sample (fault-tree symbols and the double line do not yet). */
export declare const legendNative: (b: LaidOutLegend) => boolean;
export declare function legendXml(b: LaidOutLegend, ld: LaidOutDiagram, tones: ToneEnv, fonts: Fonts, next: () => number): string;

import { textColorOf } from './tokens.ts';
import type { LaidOutDiagram, Theme, BoxTone } from './types.ts';
export declare const resolveTextColor: typeof textColorOf;
export interface BoxStyle {
    fill: string;
    stroke: string;
    dashed: boolean;
}
export declare function resolveBoxStyle(tone: BoxTone | undefined, day: Theme, dashedOverride?: boolean): BoxStyle;
export declare function emitSvg(laidOutDiagram: LaidOutDiagram): string;

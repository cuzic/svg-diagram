import type { LaidOutDiagram, Theme, TextTone, BoxTone } from './types.ts';
export declare function resolveTextColor(tone: TextTone | undefined, day: Theme): string;
export interface BoxStyle {
    fill: string;
    stroke: string;
    dashed: boolean;
}
export declare function resolveBoxStyle(tone: BoxTone | undefined, day: Theme, dashedOverride?: boolean): BoxStyle;
export declare function emitSvg(laidOutDiagram: LaidOutDiagram): string;

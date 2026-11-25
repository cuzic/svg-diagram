import type { ToneEnv } from './tokens.ts';
import type { EmphasisTone, Theme } from './types/core.ts';
export interface BoxStyle {
    fill: string;
    stroke: string;
    dashed: boolean;
}
export declare function resolveBoxStyle(tones: ToneEnv, tone: EmphasisTone | undefined, day: Theme, dashedOverride?: boolean): BoxStyle;

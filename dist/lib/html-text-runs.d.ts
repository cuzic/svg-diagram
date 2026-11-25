import { type FontBox } from './html-adapter.ts';
import type { ToneEnv } from './tokens.ts';
import type { Theme, Align, EmphasisTone } from './types/core.ts';
import type { WrappedRun } from './types/text-bands.ts';
export declare function textRuns(runs: WrappedRun[], o: {
    originX: number;
    originY: number;
    w: number;
    align: Align;
    day: Theme;
    tones: ToneEnv;
    fb: FontBox;
    dim?: boolean;
    boxTone?: EmphasisTone;
}): string;

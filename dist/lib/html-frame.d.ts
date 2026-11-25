import type { ToneEnv } from './tokens.ts';
import type { Theme, EmphasisTone, Rect } from './types/core.ts';
export declare function shape(r: Rect, o: {
    tone?: EmphasisTone;
    dashed?: boolean;
    dim?: boolean;
}, day: Theme, tones: ToneEnv, fallbackTone: EmphasisTone): string;

import type { Theme } from './types/core.ts';
import type { LaidOutMath, MathBand } from './types/math.ts';
import type { ToneEnv } from './tokens.ts';
/** MathJax's SVG output is drawn in 1000 units per em. */
export declare const UNITS_PER_EM = 1000;
/** layoutMath()'s width error: fill mode reads it as "this scale is too big" (by type, not by its message, which holds the TeX source). */
export declare class MathTooWideError extends Error {
}
export declare function layoutMath(band: MathBand, x: number, y: number, cw: number, size: number, day: Theme, tones: ToneEnv): LaidOutMath;

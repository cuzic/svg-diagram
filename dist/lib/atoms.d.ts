import type { FontFamily, WidthOf } from './types/core.ts';
export declare function splitAtoms(text: string): string[];
/** Width of single-line text: the sum of its atoms' measured widths. The one place this sum is written. */
export declare function textWidth(widthOf: WidthOf, text: string, size: number, weight: number, font?: FontFamily): number;

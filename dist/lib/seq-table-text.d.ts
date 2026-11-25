import type { WidthOf, FontFamily, WrapMode } from './types/core.ts';
export declare const lineH: (size: number) => number;
export declare const wrap: (text: string, size: number, weight: number, font: FontFamily, maxW: number, widthOf: WidthOf, mode: WrapMode) => string[];
export declare const textW: (text: string, size: number, weight: number, font: FontFamily, widthOf: WidthOf) => number;

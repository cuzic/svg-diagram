import type { Roles, WidthOf, WrapMode } from './types/core.ts';
import type { LaidOutWordArt, WordArtBand } from './wordart-types.ts';
/** [text, size, weight, font] of everything layoutWordArt() measures. */
export declare function wordArtTexts(b: WordArtBand, roles: Roles): [string, number, number, 'sans' | 'mono'][];
export declare function layoutWordArt(b: WordArtBand, x: number, y: number, cw: number, widthOf: WidthOf, roles: Roles, mode: WrapMode): LaidOutWordArt;

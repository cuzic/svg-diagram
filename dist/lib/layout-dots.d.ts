import type { FontFamily, Theme, WidthOf, Roles } from './types/core.ts';
import type { DotsBand, LaidOutDots } from './types/people-dots.ts';
/** Every string a dots() band draws, registered before its geometry is calculated. */
export declare function dotsTexts(band: DotsBand, roles: Roles): [string, number, number, FontFamily][];
export declare function layoutDots(band: DotsBand, x: number, y: number, cw: number, widthOf: WidthOf, day: Theme, roles: Roles): LaidOutDots;

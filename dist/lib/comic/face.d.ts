import type { ComicLaidHead } from '../types/comic.ts';
export declare const hairColor: (hue: number) => string;
export declare const clothesColor: (hue: number) => string;
/**
 * One person: the shoulders (cut by the panel's bottom edge), the head, the hair, the face. `idPrefix` makes the two clip paths unique in the SVG.
 * The head's centre is (cx, cy); the shoulders end on the panel's bottom edge, `HEAD_FROM_BOTTOM` below the centre.
 */
export declare function faceSvg(h: Pick<ComicLaidHead, 'cx' | 'cy' | 'expression'>, hue: number, hair: 'short' | 'long', bottom: number, idPrefix: string): string;

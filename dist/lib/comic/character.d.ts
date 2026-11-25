import type { CharacterManifest, ComicCharacter, ComicExpression, ComicLaidHead } from '../types/comic.ts';
import type { Rect } from '../types/core.ts';
export declare const EXPRESSIONS: readonly ComicExpression[];
/**
 * Checks a manifest and returns the cleaned character. Throws, naming the field, on a shape that cannot be drawn; a missing licence throws too (a character
 * with no licence must not travel with a comic: `comic-license-missing`).
 */
export declare function loadCharacter(m: CharacterManifest): ComicCharacter;
type StageHead = Pick<ComicLaidHead, 'cx' | 'cy' | 'r'>;
/** A point of the box on the panel. */
export declare const mapPoint: (c: ComicCharacter, head: StageHead, p: readonly [number, number]) => [number, number];
/** The viewport's origin and scale, using the same mapping as the anchors. */
export declare function placement(c: ComicCharacter, head: StageHead): {
    scale: number;
    x: number;
    y: number;
};
/** The part of the artwork above the stage head, spanning the width of the placed viewBox. */
export declare function characterOverhang(c: ComicCharacter, head: StageHead): Rect | undefined;
/**
 * The fragment of an expression, placed on the stage head: a nested `<svg>` whose viewBox is the character's box and whose size is the box at the scale (the box is
 * cut by it, and the panel's frame cuts what is below the chest). A nested viewBox places the drawing without a `transform`, and its ids are prefixed (the same
 * character twice in one SVG never shares a gradient or a clip path id).
 */
export declare function characterSvg(c: ComicCharacter, expression: ComicExpression, head: StageHead, idPrefix: string): string | undefined;
export {};

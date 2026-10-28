import type { FontSpecs } from './types/project.ts';
/**
 * `svg` with the emoji of its <text> elements drawn in color, or `svg` itself when there are none, the emoji font has no color glyphs, or
 * the markup is not what this reads (then the emoji are what resvg makes of them).
 */
export declare function withColorEmoji(svg: string, specs?: FontSpecs): string;

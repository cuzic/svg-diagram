import { type RenderChecks } from './svg-lint.ts';
import type { FontSpecs } from './types/project.ts';
/** null when there is no <svg>; throws (with the reason) for XML it cannot read, and when a font file for the text boxes cannot be found. */
export declare function geometryChecks(src: string, specs?: FontSpecs): RenderChecks | null;
export type { RenderChecks };

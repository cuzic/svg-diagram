// geometryChecks(): lintGeometry() with the text boxes read from the font files (ADR 0031 §3). A shell file: the geometry engine itself
// (svg-lint.ts, svg-geom.ts) is handed the measuring function and reads nothing.
import {textBox} from './font-metrics.ts';
import {lintGeometry, type RenderChecks} from './svg-lint.ts';
import type {FontSpecs} from './types/project.ts';

/** null when there is no <svg>; throws (with the reason) for XML it cannot read, and when a font file for the text boxes cannot be found. */
export function geometryChecks(src: string, specs?: FontSpecs): RenderChecks | null {
  return lintGeometry(src, (text, family, size, weight) => textBox(text, family, size, weight, specs));
}

export type {RenderChecks};

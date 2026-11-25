import type { FontSpecs } from './types/project.ts';
import type { WebMeasurer } from './web.ts';
/** Measure with the Node font backend, independently of drawing or browser startup. */
export declare function fontMeasurer(fonts?: FontSpecs): WebMeasurer;

import { definitionOfBand } from './full-definitions.js';
import { located as locatedWith } from './located.js';
/** `located` for the all-in-one builders: their bands are plain data until a diagram is rendered, so nested parts are found by type. */
export const located = (fn) => locatedWith(fn, definitionOfBand);

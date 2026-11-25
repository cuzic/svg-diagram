import {definitionOfBand} from './full-definitions.ts';
import {located as locatedWith} from './located.ts';

/** `located` for the all-in-one builders: their bands are plain data until a diagram is rendered, so nested parts are found by type. */
export const located = <F>(fn: F): F => locatedWith(fn, definitionOfBand);

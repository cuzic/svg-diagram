import { axisMismatchFindings, compareAxes } from './axis-comparison.js';
import { definedNestedBandsOf, defOf } from './band-def.js';
export const selectedAxisFindings = ({ bands }) => axisMismatchFindings(compareAxes(bands, band => defOf(band)?.valueAxis?.(band), definedNestedBandsOf));

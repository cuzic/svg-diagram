import {axisMismatchFindings, compareAxes} from './axis-comparison.ts';
import {definedNestedBandsOf, defOf} from './band-def.ts';
import type {DiagramFindings} from './band-def.ts';

export const selectedAxisFindings: DiagramFindings = ({bands}) =>
  axisMismatchFindings(compareAxes(bands, band => defOf(band)?.valueAxis?.(band), definedNestedBandsOf));

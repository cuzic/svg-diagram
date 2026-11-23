import type {LaidOutDiagram} from '../types/index.ts';
import {minTextPt, placeShapes} from './deck.ts';
import {fontsOf, planSlide} from './slide.ts';

/** A figure's smallest text in pt at scale 1, counted as the .pptx counts it (null without text). */
export function figureMinPt(laidOut: LaidOutDiagram): number | null {
  const plan = planSlide(laidOut, fontsOf(undefined)), inner = /<\/p:grpSpPr>([\s\S]*)<\/p:spTree>/.exec(plan.xml)?.[1] ?? '';
  return minTextPt(placeShapes(inner, 1, 0, 0));
}

import { minTextPt, placeShapes } from './deck.js';
import { fontsOf, planSlide } from './slide.js';
/** A figure's smallest text in pt at scale 1, counted as the .pptx counts it (null without text). */
export function figureMinPt(laidOut) {
    const plan = planSlide(laidOut, fontsOf(undefined)), inner = /<\/p:grpSpPr>([\s\S]*)<\/p:spTree>/.exec(plan.xml)?.[1] ?? '';
    return minTextPt(placeShapes(inner, 1, 0, 0));
}

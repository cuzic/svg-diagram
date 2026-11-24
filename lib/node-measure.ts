import {textBox} from './font-metrics.ts';
import type {FontSpecs} from './types/project.ts';
import type {WebMeasurer} from './web.ts';

/** Measure with the Node font backend, independently of drawing or browser startup. */
export function fontMeasurer(fonts?: FontSpecs): WebMeasurer {
  return ({text, size, weight, font}) => {
    const {w, ascent, descent} = textBox(text, font, size, weight, fonts);
    return {w, h: ascent + descent};
  };
}

import { textBox } from './font-metrics.js';
/** Measure with the Node font backend, independently of drawing or browser startup. */
export function fontMeasurer(fonts) {
    return ({ text, size, weight, font }) => {
        const { w, ascent, descent } = textBox(text, font, size, weight, fonts);
        return { w, h: ascent + descent };
    };
}

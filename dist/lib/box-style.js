import { colorOf, toneStyle } from './tokens.js';
export function resolveBoxStyle(tones, tone, day, dashedOverride) {
    const t = toneStyle(tones, tone);
    // doc themes (string keys) use a stroke that reaches 3:1 against the page; the slide decks keep the pale border
    const stroke = typeof day === 'string' ? t.stroke : t.slideStroke ?? t.stroke;
    return { fill: colorOf(t.fill, day), stroke: colorOf(stroke ?? t.fill, day), dashed: dashedOverride ?? t.dashed };
}

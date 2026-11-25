import { definitionFor } from './full-definitions.js';
import { collectRectsWith } from './verify-rects.js';
/** @internal The built-in definition of a placed band (its figure kind or matrix layout included). */
export function placedDefinitionOf(band) {
    return definitionFor(band);
}
/** Every text size one placed band draws, as its definition lists them. */
export function bandTextSizes(band) {
    return placedDefinitionOf(band)?.textSizes?.(band) ?? [];
}
/** Every checkable rect of a laid-out figure, in band order. */
export function collectRects(diagram) {
    return collectRectsWith(diagram, placedDefinitionOf);
}

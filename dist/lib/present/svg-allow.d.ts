export type SvgProblem = {
    where: string;
    what: string;
};
export type SvgCheck = {
    ok: true;
} | {
    ok: false;
    problems: SvgProblem[];
};
/** The elements a slide may contain: what the renderer, `outlineText` (live emoji) and the color emoji / image bands emit. */
export declare const ALLOWED_ELEMENTS: readonly ['svg', 'g', 'defs', 'symbol', 'use', 'title', 'desc', 'style', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'image', 'text', 'tspan', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'pattern', 'marker', 'filter', 'feColorMatrix', 'feGaussianBlur', 'feOffset', 'feFlood', 'feComposite', 'feBlend', 'feMerge', 'feMergeNode'];
/** The attributes a slide may use, on any allowed element (`href` only on HREF_ELEMENTS). Also every `data-*` and `aria-*`. */
export declare const ALLOWED_ATTRIBUTES: readonly ['id', 'class', 'style', 'lang', 'role', 'version', 'xmlns', 'xmlns:xlink', 'xml:space', 'href', 'xlink:href', 'x', 'y', 'width', 'height', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'fx', 'fy', 'fr', 'd', 'points', 'pathLength', 'transform', 'viewBox', 'preserveAspectRatio', 'dx', 'dy', 'rotate', 'textLength', 'lengthAdjust', 'text-anchor', 'dominant-baseline', 'alignment-baseline', 'baseline-shift', 'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant', 'font-stretch', 'letter-spacing', 'word-spacing', 'text-decoration', 'writing-mode', 'direction', 'unicode-bidi', 'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'color', 'paint-order', 'vector-effect', 'visibility', 'display', 'overflow', 'shape-rendering', 'text-rendering', 'image-rendering', 'color-interpolation', 'color-interpolation-filters', 'clip-path', 'clip-rule', 'mask', 'filter', 'marker-start', 'marker-mid', 'marker-end', 'offset', 'stop-color', 'stop-opacity', 'gradientUnits', 'gradientTransform', 'spreadMethod', 'clipPathUnits', 'maskUnits', 'maskContentUnits', 'patternUnits', 'patternContentUnits', 'patternTransform', 'markerWidth', 'markerHeight', 'markerUnits', 'refX', 'refY', 'orient', 'filterUnits', 'primitiveUnits', 'in', 'in2', 'result', 'type', 'values', 'stdDeviation', 'mode', 'operator', 'k1', 'k2', 'k3', 'k4', 'flood-color', 'flood-opacity'];
/** Attribute name patterns allowed besides ALLOWED_ATTRIBUTES. */
export declare const ALLOWED_ATTRIBUTE_PATTERNS: readonly [RegExp, RegExp];
/** The elements that may carry `href` / `xlink:href`: `#id` on all of them, a PNG / JPEG `data:` URL on `<image>` only. */
export declare const HREF_ELEMENTS: readonly ['use', 'image', 'linearGradient', 'radialGradient', 'pattern'];
/** The only at-rule a `<style>` may hold (the `appearance: 'auto'` block). */
export declare const ALLOWED_AT_RULES: readonly ['media'];
/** What is wrong with a stylesheet or a style="" value: only `@media`, `url(#id)`, no escapes and nothing that loads. */
export declare function cssProblems(css: string): string[];
/** Check one slide's SVG against the allowlist (ADR 0056 D3). `where` is an element path and the offset (in UTF-16 code units) of the tag. */
export declare function checkSlideSvg(svg: string): SvgCheck;

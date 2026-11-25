import { SLIDE_CANVAS } from './tokens.js';
import { CANVAS_LIMITS, MAX_SPEC_PARTS, SPEC_VERSION, SPEC_WIDTH, list, object, oneOf, text } from './spec-kit.js';
/** The width a figure without a canvas is drawn at: a document's text column (diagram() in lib/dsl/diagram.ts). */
const DOC_WIDTH = 940;
/** The document schema with the available parts and notation options of its renderer. */
export function schemaForParts(parts, autoLegend = true) {
    return object({
        version: { const: SPEC_VERSION, description: 'Always 1.' },
        lang: { ...oneOf('ja', 'en'), description: "The language of the words the figure writes by itself (legends, headings such as 'Today'): ja (default) or en. Write your own text in the same language." },
        title: text('The accessible name of the figure. Drawn above it only with showTitle.', 120),
        showTitle: { type: 'boolean', description: 'true: draw the title above the figure.' },
        desc: text('A one-sentence description for screen readers.', 400),
        sourceLine: text('Where the content comes from, printed under the figure.', 120),
        theme: { ...oneOf('blue', 'teal', 'amber'), description: 'Default blue.' },
        appearance: oneOf('light', 'dark'),
        density: oneOf('normal', 'compact'),
        width: { type: 'integer', minimum: SPEC_WIDTH.min, maximum: SPEC_WIDTH.max, description: `The width the figure is laid out at, in px (${SPEC_WIDTH.min} to ${SPEC_WIDTH.max}, default ${SPEC_WIDTH.max}): narrower makes boxes and tables wrap their text instead of the figure being shrunk later (a column of a slide). Text sizes do not change.` },
        legend: autoLegend ? { enum: ['auto', false], description: "'auto' lists the notation used; false shows no legend." } : { enum: [false], description: 'No automatic legend.' },
        canvas: object({
            width: { type: 'integer', minimum: CANVAS_LIMITS.width[0], maximum: CANVAS_LIMITS.width[1], description: `The width of the canvas in px (default ${SLIDE_CANVAS.width}).` },
            height: { type: 'integer', minimum: CANVAS_LIMITS.height[0], maximum: CANVAS_LIMITS.height[1], description: `The height of the canvas in px (default ${SLIDE_CANVAS.height}). With fit 'content', the most it may be.` },
            minText: { type: 'number', minimum: CANVAS_LIMITS.minText[0], maximum: CANVAS_LIMITS.minText[1], description: `The smallest text in px (default ${SLIDE_CANVAS.minText}). Every text, box and gap grows by minText / 14.` },
            fit: { ...oneOf('content'), description: "'content': the canvas is as tall as what it holds, up to height. Left out: always height tall." },
        }, [], `A figure for a slide or a screen, shown at its own size (1920x1080 for a full HD slide), instead of a figure for a document (${DOC_WIDTH}px wide, shown in a text column). Text and boxes grow with minText, so a large canvas holds more only when minText stays small.`),
        parts: list({ oneOf: parts.map(p => p.schema) }, MAX_SPEC_PARTS, 1),
    }, ['version', 'title', 'parts']);
}

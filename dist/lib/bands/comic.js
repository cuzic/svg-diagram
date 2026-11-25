import { band } from '../band-def.js';
import { texts } from '../band-text-sizes.js';
import { renderComicBand } from '../comic/emit.js';
import { comicAcceptHint, comicAdvice, comicProblems, comicRuleDocs } from '../comic/findings.js';
import { layoutComic } from '../comic/layout.js';
import { comicMeasure } from '../comic/measure.js';
import { parseTemplate, slotIdsOf } from '../comic/template.js';
import { comic as build } from '../dsl/comic.js';
import { appendPlacedBand } from '../layout-placed.js';
import { comicConnectorProblems, comicRects } from '../verify-comic-rects.js';
const definition = {
    type: 'comic',
    textSizes: texts,
    internal: true,
    ids({ sheet }) {
        const ids = new Set();
        for (const panel of sheet.panels) {
            ids.add(panel.id);
            for (const dlg of panel.dialogue) {
                const id = `${panel.id}.${dlg.id}`;
                ids.add(id);
                for (const slot of slotIdsOf(parseTemplate(dlg.tpl, `comic(): ${id}`)))
                    ids.add(slot);
            }
        }
        return [...ids];
    },
    layout(data, ctx, x, w) {
        const laid = layoutComic(data, x, ctx.originOf(data, ctx.y), w, ctx.widthOf);
        appendPlacedBand(data, laid, ctx, 'a comic takes an id that another anchor already has', 'a comic panel or bubble takes an id that another anchor already has');
    },
    measure(data, { atoms }) {
        for (const [text, size, weight, font] of comicMeasure(data))
            atoms(text, size, weight, font);
    },
    emit: laid => renderComicBand(laid),
    nameNodes: laid => ({ ...laid, nodeIds: true }),
    nodeIds: 'self',
    rectsQualified: true,
    rules: comicRuleDocs,
    verify: {
        rects: comicRects,
        layoutFindings: comicAdvice,
        check: (laid, { connects }) => [
            ...comicProblems(laid),
            ...comicConnectorProblems(laid, connects).map(message => ({ rule: 'comic', severity: 'problem', message })),
        ],
        acceptHint: comicAcceptHint,
    },
};
/** Builds a comic worksheet band for renderBands(). */
export function comic(sheet, opts) {
    const data = build(sheet, opts);
    return band(definition, data);
}
/** @internal Definition used by the full renderer. */
export const comicDefinition = definition;

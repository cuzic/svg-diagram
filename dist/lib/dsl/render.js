import { withNodeIds } from '../emit-node-ids.js';
import { placedDefinitionOf } from '../placed-definitions.js';
import { resolveImages } from '../image-file.js';
import { prepareLegacyDiagramWithCore, renderLegacyDiagramWithCore } from '../legacy-core.js';
import { defaultMeasureSettings, measureAll } from '../measure.js';
import { walkAnyBands as walkBands } from '../full-definitions.js';
import { detachData } from './diagram.js';
import { throwAtDiagram } from '../source-ref.js';
/** detachData() plus the pictures image() left unread, read from the source's folder. */
function detach(d) {
    const out = detachData(d);
    resolveImages(walkBands(out.bands), out.sourceDir ?? process.cwd());
    out.measure ??= defaultMeasureSettings();
    return out;
}
// Everything build() does short of the disk: layout (with the slide budget and the fill / font scale search), verification,
// the SVG, its XML well-formedness. It does not throw for a failed verification or a malformed SVG — it reports them in
// `verdict` and `xml`, so build() can refuse to write while `svg-diagram show` can still draw the picture and say what is wrong.
// (A define()/constructor/layout error still throws.) budget: 'measure' measures a slide that has no cached budget (starts the
// dev server, writes the cache); 'cacheOnly' reads the cache and falls back to the default sizes with a note.
export async function renderDiagram(input, opts) {
    return (await renderWithStages(input, opts)).result;
}
/** @internal Keep the prepared SVG emitter for build's reveal files. */
export function renderWithStages(input, opts) {
    return render(input, opts).catch(e => throwAtDiagram(e, input));
}
async function render(input, opts) {
    const d = detach(input);
    const notes = [];
    let budget = null;
    let budgetSource = null;
    if (d.slide) {
        const { getSlideBudget, readSlideBudgetCache } = await import('../slide-budget.js');
        const key = { ...d.slide, svg: opts.name };
        if (opts.budget === 'measure') {
            budget = await getSlideBudget(key);
            budgetSource = budget.cached ? 'cache' : 'measured';
        }
        else {
            budget = readSlideBudgetCache(key);
            budgetSource = budget ? 'cache' : 'default';
            if (!budget)
                notes.push(`スライドの空き寸法が未計測(キャッシュなし)なので既定の寸法で描いた。\`svg-diagram build\` で一度実測すると正確になる`);
        }
    }
    if (d.fill && !budget && (opts.budget === 'measure' || !d.slide)) {
        throw new Error('diagram({fill: true}) needs diagram({slide: {page, heading}}) to know the slot size');
    }
    const result = await renderLegacyDiagramWithCore(d, {
        measureBatch: requests => measureAll(requests, d.measure),
        budget, nodeIds: opts.nodeIds, html: opts.html,
    });
    const { svg, laidOut, verdict, xml, width, height, fit, fontScale } = result;
    let html;
    if (opts.html) {
        const [{ emitHtml }, { fontBoxOf }] = await Promise.all([import('../emit-html.js'), import('../font-box.js')]);
        html = emitHtml(laidOut, { reveal: result.stage, fontBox: fontBoxOf(laidOut.measure), emit: result.emit });
    }
    const rendered = { svg, ...(html !== undefined ? { html } : {}), laidOut, verdict, xml, notes: [...notes, ...result.notes], width, height, fit, budget, budgetSource, fontScale };
    const emitRevealStage = (stage) => result.emit(opts.nodeIds ? withNodeIds(laidOut, placedDefinitionOf) : laidOut, false, undefined, stage);
    return { result: rendered, emitRevealStage };
}
// Layout + verification + rules, without writing any file: the engine behind `svg-diagram check`.
export async function checkDiagram(input) {
    try {
        const d = detach(input);
        const { placed, verdict } = await prepareLegacyDiagramWithCore(d, { measureBatch: requests => measureAll(requests, d.measure) });
        return { laidOut: placed, verdict };
    }
    catch (e) {
        throwAtDiagram(e, input);
    }
}

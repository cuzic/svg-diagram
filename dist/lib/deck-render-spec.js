import { applyConfig } from './config.js';
import { analyzeFit } from './fit.js';
import { bandTextSizes } from './placed-definitions.js';
import { measureAll } from './measure.js';
import { measureSettingsOf } from './measure-settings.js';
import { loadSpecPartsFor } from './spec-cli-parts.js';
import { prepareSpecLayout } from './spec-selective.js';
import { xmlProblems } from './xml-check.js';
export async function renderDeckSpec(spec, cfg) {
    const parts = await loadSpecPartsFor(spec);
    if (!parts)
        return undefined;
    const doc = spec;
    if (doc.canvas !== undefined)
        return undefined;
    try {
        const [captions, autoLegend] = await Promise.all([
            doc.showTitle === true || typeof doc.sourceLine === 'string'
                ? import('./bands/caption.js').then(m => m.captionDefinition) : undefined,
            (doc.legend ?? cfg.legend) === 'auto'
                ? import('./bands/legend.js').then(m => m.autoLegend) : undefined,
        ]);
        const measure = measureSettingsOf(cfg);
        const draw = prepareSpecLayout(spec, { parts, captions, autoLegend, project: cfg });
        const { placed, emit, verdict } = await draw({ measureBatch: requests => measureAll(requests, measure) });
        const laidOut = applyConfig({ ...placed, legend: doc.legend, measure, fontScale: 1,
            showTitle: doc.showTitle === true, sourceLine: typeof doc.sourceLine === 'string' ? doc.sourceLine : undefined }, cfg);
        const svg = emit(laidOut);
        return { svg, laidOut, verdict, xml: xmlProblems(svg), notes: [], width: laidOut.width,
            height: laidOut.canvasHeight, fit: analyzeFit(laidOut, bandTextSizes), budget: null, budgetSource: null, fontScale: 1 };
    }
    catch {
        // The legacy renderer supplies the existing source-aware validation and layout errors.
        return undefined;
    }
}

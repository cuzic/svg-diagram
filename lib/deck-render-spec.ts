import {applyConfig} from './config.ts';
import {analyzeFit} from './fit.ts';
import {bandTextSizes} from './placed-definitions.ts';
import {measureAll} from './measure.ts';
import {measureSettingsOf} from './measure-settings.ts';
import {loadSpecPartsFor} from './spec-cli-parts.ts';
import {prepareSpecLayout} from './spec-selective.ts';
import {xmlProblems} from './xml-check.ts';
import type {Config} from './types/project.ts';
import type {RenderResult} from './types/verdicts.ts';

export async function renderDeckSpec(spec: unknown, cfg: Config): Promise<RenderResult | undefined> {
  const parts = await loadSpecPartsFor(spec);
  if (!parts) return undefined;
  const doc = spec as {canvas?: unknown; showTitle?: unknown; sourceLine?: unknown; legend?: 'auto' | false};
  if (doc.canvas !== undefined) return undefined;
  try {
    const [captions, autoLegend] = await Promise.all([
      doc.showTitle === true || typeof doc.sourceLine === 'string'
        ? import('./bands/caption.ts').then(m => m.captionDefinition) : undefined,
      (doc.legend ?? cfg.legend) === 'auto'
        ? import('./bands/legend.ts').then(m => m.autoLegend) : undefined,
    ]);
    const measure = measureSettingsOf(cfg);
    const draw = prepareSpecLayout(spec, {parts, captions, autoLegend, project: cfg});
    const {placed, emit, verdict} = await draw({measureBatch: requests => measureAll(requests, measure)});
    const laidOut = applyConfig({...placed, legend: doc.legend, measure, fontScale: 1,
      showTitle: doc.showTitle === true, sourceLine: typeof doc.sourceLine === 'string' ? doc.sourceLine : undefined}, cfg);
    const svg = emit(laidOut);
    return {svg, laidOut, verdict, xml: xmlProblems(svg), notes: [], width: laidOut.width,
      height: laidOut.canvasHeight, fit: analyzeFit(laidOut, bandTextSizes), budget: null, budgetSource: null, fontScale: 1};
  } catch {
    // The legacy renderer supplies the existing source-aware validation and layout errors.
    return undefined;
  }
}

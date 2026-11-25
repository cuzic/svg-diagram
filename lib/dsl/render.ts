import {withNodeIds} from '../emit-node-ids.ts';
import {resolveImages} from '../image-file.ts';
import {prepareLegacyDiagramWithCore, renderLegacyDiagramWithCore} from '../legacy-core.ts';
import {defaultMeasureSettings, measureAll} from '../measure.ts';
import type {Diagram, DiagramData} from '../types/core.ts';
import type {RenderResult, CheckResult, SlideBudget} from '../types/verdicts.ts';
import {walkBands} from '../legend-notation.ts';
import {detachData} from './diagram.ts';
import {throwAtDiagram} from '../source-ref.ts';

/** detachData() plus the pictures image() left unread, read from the source's folder. */
function detach<D extends DiagramData>(d: D): D {
  const out = detachData(d);
  resolveImages(walkBands(out.bands), out.sourceDir ?? process.cwd());
  out.measure ??= defaultMeasureSettings();
  return out;
}
type RenderOptions = {name: string; budget: 'measure' | 'cacheOnly'; html?: boolean; /** `data-node="id"` on the outline of each author-named node (ADR 0034) */ nodeIds?: boolean};

// Everything build() does short of the disk: layout (with the slide budget and the fill / font scale search), verification,
// the SVG, its XML well-formedness. It does not throw for a failed verification or a malformed SVG — it reports them in
// `verdict` and `xml`, so build() can refuse to write while `svg-diagram show` can still draw the picture and say what is wrong.
// (A define()/constructor/layout error still throws.) budget: 'measure' measures a slide that has no cached budget (starts the
// dev server, writes the cache); 'cacheOnly' reads the cache and falls back to the default sizes with a note.
export async function renderDiagram(input: Diagram, opts: RenderOptions): Promise<RenderResult> {
  return (await renderWithStages(input, opts)).result;
}

/** @internal Keep the prepared SVG emitter for build's reveal files. */
export function renderWithStages(input: Diagram, opts: RenderOptions) {
  return render(input, opts).catch(e => throwAtDiagram(e, input));
}

async function render(input: Diagram, opts: RenderOptions) {
  const d = detach(input);
  const notes: string[] = [];
  let budget: SlideBudget | null = null;
  let budgetSource: RenderResult['budgetSource'] = null;
  if (d.slide) {
    const {getSlideBudget, readSlideBudgetCache} = await import('../slide-budget.ts');
    const key = {...d.slide, svg: opts.name};
    if (opts.budget === 'measure') {
      budget = await getSlideBudget(key);
      budgetSource = budget.cached ? 'cache' : 'measured';
    } else {
      budget = readSlideBudgetCache(key);
      budgetSource = budget ? 'cache' : 'default';
      if (!budget) notes.push(`スライドの空き寸法が未計測(キャッシュなし)なので既定の寸法で描いた。\`svg-diagram build\` で一度実測すると正確になる`);
    }
  }
  if (d.fill && !budget && (opts.budget === 'measure' || !d.slide)) {
    throw new Error('diagram({fill: true}) needs diagram({slide: {page, heading}}) to know the slot size');
  }
  const result = await renderLegacyDiagramWithCore(d, {
    measureBatch: requests => measureAll(requests, d.measure),
    budget, nodeIds: opts.nodeIds, html: opts.html,
  });
  const {svg, laidOut, verdict, xml, width, height, fit, fontScale} = result;
  let html: string | undefined;
  if (opts.html) {
    const [{emitHtml}, {fontBoxOf}] = await Promise.all([import('../emit-html.ts'), import('../font-box.ts')]);
    html = emitHtml(laidOut, {reveal: result.stage, fontBox: fontBoxOf(laidOut.measure), emit: result.emit});
  }
  const rendered: RenderResult = {svg, ...(html !== undefined ? {html} : {}), laidOut, verdict, xml, notes: [...notes, ...result.notes], width, height, fit, budget, budgetSource, fontScale};
  const emitRevealStage = (stage: number) => result.emit(opts.nodeIds ? withNodeIds(laidOut) : laidOut, false, undefined, stage);
  return {result: rendered, emitRevealStage};
}
// Layout + verification + rules, without writing any file: the engine behind `svg-diagram check`.
export async function checkDiagram(input: DiagramData): Promise<CheckResult> {
  try {
    const d = detach(input);
    const {placed, verdict} = await prepareLegacyDiagramWithCore(d, {measureBatch: requests => measureAll(requests, d.measure)});
    return {laidOut: placed, verdict};
  } catch (e) { throwAtDiagram(e, input); }
}

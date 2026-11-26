// Drawing a JSON spec where there is no file system and no native code, such as a Cloudflare Worker ("svg-diagram/spec/edge"). The caller hands in
// the text engine; the result is an SVG with its text as outlines, so the picture does not depend on the fonts of whoever opens it.
import {renderInBrowser} from './web.ts';
import {SpecError, specToDiagram} from './spec.ts';
import type {RenderSpecResult} from './spec-result.ts';
import {guardedEngine, MAX_EDGE_HEIGHT, nothing, renderEdgeResult} from './spec-edge-core.ts';
import type {TextEngine} from './spec-edge-core.ts';
import {idPrefixProblem, prepareForEmbedding} from './svg-ids.ts';
import type {EmbedOptions} from './svg-ids.ts';
import type {Diagram} from './types/core.ts';

export {guardedEngine, MAX_EDGE_HEIGHT, missingIssues, TextEngineError} from './spec-edge-core.ts';
export type {TextEngine} from './spec-edge-core.ts';
export type {OutlineFont} from './svg-outline.ts';
export type {RenderSpecResult} from './spec-result.ts';

/**
 * Draw and check a spec, and turn its text into outlines. A bad spec, a figure that does not fit, or a character the font lacks comes back in the
 * result, with its place. A failure of the engine that was handed in throws TextEngineError.
 */
export async function renderSpecEdge(spec: unknown, givenEngine: TextEngine, opts: {maxHeight?: number} & EmbedOptions = {}): Promise<RenderSpecResult> {
  const bad = opts.idPrefix === undefined ? null : idPrefixProblem(opts.idPrefix);
  if (bad) return nothing([{path: '', message: bad}]);
  const engine = guardedEngine(givenEngine);
  let d: Diagram;
  try { d = specToDiagram(spec); }
  catch (e) {
    if (e instanceof SpecError) return nothing([...e.issues]);
    throw e;
  }
  const r = await renderEdgeResult(spec, engine, opts.maxHeight ?? MAX_EDGE_HEIGHT, () => renderInBrowser(d, {measure: engine.measure}));
  return r.svg === null ? r : {...r, svg: prepareForEmbedding(r.svg, opts)};
}

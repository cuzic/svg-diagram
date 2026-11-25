import {guardedEngine, MAX_EDGE_HEIGHT, nothing, renderEdgeResult} from './spec-edge-core.ts';
import type {TextEngine} from './spec-edge-core.ts';
import {prepareVerifiedSpecRender, SpecError} from './spec-selective.ts';

export {MAX_EDGE_HEIGHT, TextEngineError} from './spec-edge-core.ts';
export type {TextEngine} from './spec-edge-core.ts';
export type {RenderSpecResult} from './spec-result.ts';
export type {OutlineFont} from './svg-outline.ts';
export {partCatalog, specSchemaFor, validateSpec} from './spec-selective.ts';

/** Draw and outline only the registered spec parts, with a caller-supplied text engine. */
export async function renderSpecEdge(spec: unknown, givenEngine: TextEngine, options: Parameters<typeof prepareVerifiedSpecRender>[1] & {maxHeight?: number}) {
  const engine = guardedEngine(givenEngine);
  let draw: ReturnType<typeof prepareVerifiedSpecRender>;
  try { draw = prepareVerifiedSpecRender(spec, options); }
  catch (error) {
    if (error instanceof SpecError) return nothing([...error.issues]);
    throw error;
  }
  return renderEdgeResult(spec, engine, options.maxHeight ?? MAX_EDGE_HEIGHT, () => draw(engine.measure));
}

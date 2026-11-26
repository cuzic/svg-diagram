import {fontMeasurer} from './node-measure.ts';
import {finishNodeSpec, isInfrastructure, MAX_FIGURE_HEIGHT, nothing} from './spec-node-result.ts';
import {layoutIssue} from './spec-result.ts';
import {prepareVerifiedSpecRender, SpecError} from './spec-selective.ts';
import type {FontSpecs} from './types/project.ts';
import type {EmbedOptions} from './svg-ids.ts';

export {MAX_FIGURE_HEIGHT} from './spec-node-result.ts';
export type {RenderSpecResult} from './spec-result.ts';
export {partCatalog, specSchemaFor, validateSpec} from './spec-selective.ts';

/** Render and verify registered spec parts using the Node font backend. */
export async function renderSpec(spec: unknown, options: Parameters<typeof prepareVerifiedSpecRender>[1] & {fonts?: FontSpecs; maxHeight?: number} & EmbedOptions) {
  let draw: ReturnType<typeof prepareVerifiedSpecRender>;
  try { draw = prepareVerifiedSpecRender(spec, options); }
  catch (error) {
    if (error instanceof SpecError) return nothing([...error.issues]);
    throw error;
  }
  let result: Awaited<ReturnType<typeof draw>>;
  try { result = await draw(fontMeasurer(options.fonts)); }
  catch (error) {
    if (isInfrastructure(error)) throw error;
    return nothing([layoutIssue(spec, error)]);
  }
  return finishNodeSpec(spec, result, options.maxHeight ?? MAX_FIGURE_HEIGHT, options.fonts, {idPrefix: options.idPrefix, inline: options.inline});
}

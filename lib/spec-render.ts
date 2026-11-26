// Drawing a JSON spec (lib/spec.ts) in Node, without writing a file, and the checks a caller of renderDiagram() otherwise only gets from
// `build`: part of "svg-diagram/render". Nothing here reads .svg-diagram.json from the working directory; a server passes its settings.
import {renderDiagram} from './dsl/render.ts';
import {applyConfig} from './config.ts';
import {SpecError, specToDiagram} from './spec.ts';
import {layoutIssue, lintMessages} from './spec-result.ts';
import type {RenderSpecResult} from './spec-result.ts';
import {finishNodeSpec, isInfrastructure, MAX_FIGURE_HEIGHT, nothing} from './spec-node-result.ts';
import type {Config} from './types/project.ts';
import type {Diagram} from './types/core.ts';
import type {RenderResult} from './types/verdicts.ts';
import {idPrefixProblem} from './svg-ids.ts';
import type {EmbedOptions} from './svg-ids.ts';

export type {RenderChecks} from './geometry-checks.ts';
export {lintRendering, MAX_FIGURE_HEIGHT} from './spec-node-result.ts';
export {MAX_PNG_PIXELS, svgToPng} from './png.ts';
export {lintMessages};
export type {RenderSpecResult};

export interface RenderSpecOptions extends EmbedOptions {
  /** Which fonts text is measured with. Default: the font lookup of this machine. */
  config?: Pick<Config, 'measure' | 'fonts'>;
  /** The name used in messages (default 'diagram.svg'). */
  name?: string;
  /** A taller figure is refused (default MAX_FIGURE_HEIGHT). */
  maxHeight?: number;
}

/**
 * Draw and check a spec. A bad spec, or a figure that does not fit, comes back in the result with its place. A failure of the machine itself
 * (a font file missing) throws. Layout is synchronous and can take seconds at the limits of the schema: a server should call this from a
 * worker with a time limit.
 */
export async function renderSpec(spec: unknown, opts: RenderSpecOptions = {}): Promise<RenderSpecResult> {
  const badPrefix = opts.idPrefix === undefined ? null : idPrefixProblem(opts.idPrefix);
  if (badPrefix) return nothing([{path: '', message: badPrefix}]);
  const config: Pick<Config, 'measure' | 'fonts'> = opts.config ?? {};
  let d: Diagram;
  try {
    d = applyConfig(specToDiagram(spec), config);
  } catch (e) {
    if (e instanceof SpecError) return nothing([...e.issues]);
    throw e;
  }
  let r: RenderResult;
  try {
    r = await renderDiagram(d, {name: opts.name ?? 'diagram.svg', budget: 'cacheOnly'});
  } catch (e) {
    if (isInfrastructure(e)) throw e;
    return nothing([layoutIssue(spec, e)]);
  }
  return finishNodeSpec(spec, r, opts.maxHeight ?? MAX_FIGURE_HEIGHT, config.fonts, {idPrefix: opts.idPrefix, inline: opts.inline});
}

// Drawing a JSON spec (lib/spec.ts) in Node, without writing a file, and the checks a caller of renderDiagram() otherwise only gets from
// `build`: part of "svg-diagram/render". Nothing here reads .svg-diagram.json from the working directory; a server passes its settings.
import {renderDiagram} from './dsl/render.ts';
import {applyConfig} from './config.ts';
import {geometryChecks, type RenderChecks} from './geometry-checks.ts';
import {rasterizeWithResvg} from './raster.ts';
import {SpecError, cappedMessages, layoutIssue, lintMessages, locateMessage, locateVerdict, specToDiagram, type RenderSpecResult, type SpecIssue} from './spec.ts';
import type {Config, FontSpecs} from './types/project.ts';
import type {Diagram} from './types/core.ts';
import type {RenderResult} from './types/verdicts.ts';

export type {RenderChecks};
export {lintMessages};
export type {RenderSpecResult};

/** The tallest figure renderSpec() returns by default. */
export const MAX_FIGURE_HEIGHT = 8000;
/** The most pixels svgToPng() allocates: resvg's buffer is outside the JS heap, so a limit on the heap would not catch it. */
export const MAX_PNG_PIXELS = 64_000_000;

/** The five checks on a drawn SVG (contrast, past the canvas, text over text, text out of its box, a shape over a text), from the SVG's own geometry; no file, no browser. null when `svg` has no <svg>. The colour-token and font-size rules of `svg-diagram lint` are not here. */
export function lintRendering(svg: string, opts: {fonts?: FontSpecs} = {}): RenderChecks | null {
  return geometryChecks(svg, opts.fonts);
}

/** The root's width and height, when both are plain numbers of pixels. Any other way of writing them ("3e4", "300in", a root hidden behind a decoy) could mean more pixels than it seems to, so it is refused. */
function plainRootSize(svg: string): {w: number; h: number} {
  const root = /^\s*(?:<\?[\s\S]*?\?>\s*|<!--[\s\S]*?-->\s*)*<svg\b([^>]*)>/.exec(svg)?.[1] ?? '';
  const read = (name: string): number => {
    const v = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(root);
    const text = v?.[1] ?? v?.[2] ?? '';
    if (!/^\d{1,6}(?:\.\d+)?(?:px)?$/.test(text)) throw new RangeError(`svgToPng: the root ${name} must be a plain number of pixels (got ${JSON.stringify(text)})`);
    return Number.parseFloat(text);
  };
  return {w: read('width'), h: read('height')};
}

/** `svg` as a PNG, drawn by resvg with the given fonts. `scale` is above 0 and at most 4; a picture over MAX_PNG_PIXELS is refused before it is allocated. */
export async function svgToPng(svg: string, opts: {scale?: number; fonts?: FontSpecs} = {}): Promise<{png: Buffer; width: number; height: number}> {
  const scale = opts.scale ?? 1;
  if (!(scale > 0 && scale <= 4)) throw new RangeError(`svgToPng: scale must be above 0 and at most 4 (got ${scale})`);
  const {w, h} = plainRootSize(svg);
  if (w * h * scale * scale > MAX_PNG_PIXELS) throw new RangeError(`svgToPng: ${w}x${h} at scale ${scale} is over ${MAX_PNG_PIXELS} pixels`);
  const r = await rasterizeWithResvg(svg, {...opts, scale, png: true});
  return {png: r.png as Buffer, width: r.width, height: r.height};
}

export interface RenderSpecOptions {
  /** Which fonts text is measured with. Default: the font lookup of this machine. */
  config?: Pick<Config, 'measure' | 'fonts'>;
  /** The name used in messages (default 'diagram.svg'). */
  name?: string;
  /** A taller figure is refused (default MAX_FIGURE_HEIGHT). */
  maxHeight?: number;
}

const nothing = (issues: SpecIssue[]): RenderSpecResult => ({ok: false, svg: null, width: 0, height: 0, issues, problems: [], findings: []});

/** A failure of this machine (a font file, the browser), as opposed to a figure that cannot be drawn: telling the caller to change the spec would be wrong. */
const isInfrastructure = (e: unknown): boolean => e instanceof Error && (typeof (e as NodeJS.ErrnoException).code === 'string' || /^measure:|font file|Chromium|playwright/i.test(e.message));
const messageOf = (e: unknown): string => e instanceof Error ? e.message : String(e);

/**
 * Draw and check a spec. A bad spec, or a figure that does not fit, comes back in the result with its place. A failure of the machine itself
 * (a font file missing) throws. Layout is synchronous and can take seconds at the limits of the schema: a server should call this from a
 * worker with a time limit.
 */
export async function renderSpec(spec: unknown, opts: RenderSpecOptions = {}): Promise<RenderSpecResult> {
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
    return nothing([layoutIssue(spec, messageOf(e))]);
  }
  const maxHeight = opts.maxHeight ?? MAX_FIGURE_HEIGHT;
  if (r.height > maxHeight) return nothing([{path: '', message: `the figure is ${r.height}px tall; the limit is ${maxHeight}px. Use fewer steps or parts, or shorter text`}]);
  const {problems, findings} = locateVerdict(spec, r.verdict);
  for (const message of r.xml) problems.push({path: locateMessage(spec, message), message, severity: 'problem'});
  if (r.xml.length === 0) {
    try {
      const checks = lintRendering(r.svg, {fonts: config.fonts});
      if (checks) {
        const {errors, advisories} = lintMessages(checks);
        for (const message of errors) problems.push({path: locateMessage(spec, message), message, severity: 'problem', rule: 'render-check'});
        for (const message of advisories) findings.push({path: locateMessage(spec, message), message, severity: 'warn', rule: 'render-check'});
      }
    } catch (e) {
      if (isInfrastructure(e)) throw e;
      problems.push({path: null, message: `the drawing could not be checked: ${messageOf(e)}`, severity: 'problem', rule: 'render-check'});
    }
  }
  return {ok: problems.length === 0, svg: r.svg, width: r.width, height: r.height, issues: [], problems: cappedMessages(problems), findings: cappedMessages(findings)};
}

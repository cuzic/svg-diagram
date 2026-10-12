// The shell around layout: measure what collectMeasures() asked for (the one await), then lay out synchronously.
// layout.ts itself does no I/O and reads no environment; the strict-width switch is read here.
import {collectMeasures, layoutWith, widthOfMeasured} from './layout.ts';
import {measureAll} from './measure.ts';
import {ROLES} from './tokens.ts';
import type {DiagramData, LaidOutDiagram, Roles} from './types.ts';

// Tests and the golden check run with SVG_DIAGRAM_STRICT_WIDTH=1 (test/helpers/strict-width.ts): an atom that was never
// registered for measuring is then an error instead of a silent width of 0.
const strictWidths = (): boolean => !!process.env.SVG_DIAGRAM_STRICT_WIDTH;

/** Measure then lay out. `roles` (default ROLES) is baked into the result as LaidOutDiagram.roles. */
export async function layoutDiagram(d: DiagramData, opts: {roles?: Roles} = {}): Promise<LaidOutDiagram> {
  const roles = opts.roles ?? ROLES;
  return layoutWith(d, roles, widthOfMeasured(await measureAll(collectMeasures(d, roles)), strictWidths()));
}

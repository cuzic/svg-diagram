import {frameLayoutFindings} from '../layout-metrics.ts';
import {texts} from '../band-text-sizes.ts';
import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import type {quadrant as legacy} from '../dsl/figures.ts';
import {withHandle} from '../dsl/shared.ts';
import {quadrantSpotlight, renderQuadrant} from '../emit-quadrant.ts';
import {layoutQuadrant, quadrantBand, quadrantTexts} from '../quadrant.ts';
import type {LaidOutQuadrant, QuadrantBand, QuadrantItem, QuadrantOpts, QuadrantPreset} from '../quadrant.ts';
import {scopeOf} from '../scope-name.ts';
import {anchorRects} from '../verify-rects.ts';
import {quadrantFindings, quadrantLayoutFindings, quadrantProblems} from '../verify-quadrant.ts';

const definition = {
  type: 'quadrant',
  selfDimming: true,
  spotlight: quadrantSpotlight,
  offGrid: true,
  textSizes: texts,
  ids: data => data.items.flatMap(item => item.id ? [item.id] : []),
  measure(data, {atoms, roles}) {
    for (const [text, size, weight, font] of quadrantTexts(data, roles)) atoms(text, size, weight, font);
  },
  layout(data, {x, y, w, widthOf, roles, wrap}) {
    const scope = scopeOf(data);
    const placed = layoutQuadrant(data, x, y, w, widthOf, roles, wrap);
    const laid = scope ? {...placed, scope} : placed;
    return {laid, h: laid.h, anchors: laid.anchors};
  },
  emit: (laid, {theme, tones}) => renderQuadrant(laid, theme, tones),
  verify: {
    diagramFindings: frameLayoutFindings,
    findings: quadrantFindings,
    layoutFindings: quadrantLayoutFindings,
    rects: laid => anchorRects(laid),
    check: laid => quadrantProblems(laid).map(message => ({rule: 'quadrant', severity: 'problem', message})),
  },
} satisfies BandDef<QuadrantBand, LaidOutQuadrant>;

function build<const Id extends string = never, const I extends readonly QuadrantItem[] = readonly []>(
  opts: Omit<QuadrantOpts, 'items'> & {id?: Id; items?: I},
): WithBandDef<ReturnType<typeof legacy<Id, I>>, LaidOutQuadrant> {
  const data = withHandle(quadrantBand(opts), opts.id) as ReturnType<typeof legacy<Id, I>>;
  return band<typeof data, LaidOutQuadrant>(definition, data);
}

function preset<const Id extends string = never, const I extends readonly QuadrantItem[] = readonly []>(
  name: QuadrantPreset, opts?: Omit<QuadrantOpts, 'items' | 'preset'> & {id?: Id; items?: I},
) {
  return build<Id, I>({...opts, preset: name});
}

export const quadrant = /* @__PURE__ */ Object.assign(build, {preset});

/** @internal Definition used by the full renderer. */
export const quadrantDefinition: BandDef<QuadrantBand, LaidOutQuadrant> = definition;

import {sizesOf} from '../band-text-sizes.ts';
import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {cloudTexts, layoutCloudBand} from '../cloud.ts';
import {cloud as build} from '../dsl/cloud.ts';
import {renderCloud} from '../emit-figures.ts';
import {snapGrid} from '../layout-util.ts';
import {scopeOf} from '../scope-name.ts';
import type {CloudBand, CloudBox, CloudOpts, LaidOutCloud} from '../types/diagrams.ts';
import {cloudProblems, cloudRects} from '../verify-cloud.ts';

const definition = {
  type: 'cloud',
  textSizes: band => [...sizesOf(band.texts), ...sizesOf(band.chips)],
  ids: data => (['a', 'b', 'c', 'd', 'd2'] as const).flatMap(key => {
    const item = data[key];
    return typeof item !== 'string' && item.id ? [item.id] : [];
  }),
  measure(data, {atoms, roles}) {
    for (const [text, size, weight, font] of cloudTexts(data, roles)) atoms(text, size, weight, font);
  },
  layout(data, {x, y, w, widthOf, roles, wrap}) {
    const scope = scopeOf(data);
    const placed = layoutCloudBand(data, x, snapGrid(y), w, widthOf, roles, {wrap, keepWords: false});
    const laid = scope ? {...placed, scope} : placed;
    return {laid, h: laid.h, anchors: laid.anchors};
  },
  emit: (laid, {theme, tones}) => renderCloud(laid, theme, tones),
  verify: {
    rects: cloudRects,
    check: laid => cloudProblems(laid).map(message => ({rule: 'cloud', severity: 'problem', message})),
  },
} satisfies BandDef<CloudBand, LaidOutCloud>;

export function cloud<const A extends CloudBox, const B extends CloudBox, const C extends CloudBox, const D extends CloudBox, const D2 extends CloudBox, const Id extends string = never>(
  boxes: {a: A; b: B; c: C; d: D; d2: D2}, opts?: CloudOpts & {id?: Id},
): WithBandDef<ReturnType<typeof build<A, B, C, D, D2, Id>>, LaidOutCloud> {
  const data = build<A, B, C, D, D2, Id>(boxes, opts);
  return band<typeof data, LaidOutCloud>(definition, data);
}

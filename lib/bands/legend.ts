import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {legend as build} from '../dsl/legend.ts';
import {legendSvgDefs, renderLegend} from '../emit-boxes.ts';
import {layoutLegend} from '../layout-legend.ts';
import type {LaidOutLegend, LegendBand, LegendItem, LegendOpts} from '../types/containers.ts';

const definition = {
  type: 'legend',
  measure(data, {atoms, roles}) {
    for (const item of data.items) atoms(item.label, roles.note, 400);
  },
  layout(data, {x, y, w, widthOf, roles}) {
    const laid = layoutLegend(data, x, y, w, widthOf, roles);
    return {laid, h: laid.h};
  },
  emit: (laid, {theme, tones, roles}) => renderLegend(laid, theme, tones, roles),
  svgDefs: legendSvgDefs,
} satisfies BandDef<LegendBand, LaidOutLegend>;

export function legend(items: LegendItem[], opts?: LegendOpts): WithBandDef<LegendBand, LaidOutLegend> {
  return band<LegendBand, LaidOutLegend>(definition, build(items, opts));
}

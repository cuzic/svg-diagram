import type { BandDef, WithBandDef } from '../band-def.ts';
import type { Band } from '../types/index.ts';
import type { LaidOutLegend, LegendBand, LegendItem, LegendOpts } from '../types/containers.ts';
export declare function legend(items: LegendItem[], opts?: LegendOpts): WithBandDef<LegendBand, LaidOutLegend>;
/** Build the legend for the notation in a selected diagram, if it needs any entries. */
export declare function autoLegend(bands: readonly {
    type: string;
}[], labels?: Partial<Record<string, string>>, dimmed?: Set<Band>): WithBandDef<LegendBand, LaidOutLegend> | undefined;
/** @internal Definition used by the full renderer. */
export declare const legendDefinition: BandDef<LegendBand, LaidOutLegend>;

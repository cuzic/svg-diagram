import type { BandDef, WithBandDef } from '../band-def.ts';
import type { BubblePoint, BubbleOpts } from '../charts-bubble.ts';
import type { ChartBand, LaidOutChart } from '../charts.ts';
import { bubble as build } from '../dsl/bubble.ts';
export declare function bubble<const P extends readonly BubblePoint[], const Id extends string = never>(points: P, opts?: BubbleOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof build<P, Id>>, LaidOutChart>;
/** @internal Definition used by the full renderer. */
export declare const bubbleDefinition: BandDef<ChartBand, LaidOutChart>;

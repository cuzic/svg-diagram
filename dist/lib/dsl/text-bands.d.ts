import type { GroupBand, GroupOpts, LegendBand, LegendItem, LegendOpts, RawBand, RawOpts } from '../types/containers.ts';
import type { Band } from '../types/index.ts';
import type { BannerBand, BannerOpts, BoxBand, CaptionBand, CaptionOpts, RichText, StatOpts } from '../types/text-bands.ts';
import type { BoxInput, Declares, IdsOf, HandleOf, Refers, RefsOf } from '../strict.ts';
export declare function caption(text: RichText, opts?: CaptionOpts): CaptionBand;
export declare function box<const Id extends string = never>(opts: BoxInput<Id>): BoxBand & Declares<Id> & HandleOf<Id>;
/**
 * The largest scale fill: true may try. 1.8 as ever, but an opted-in size (banner headlineRole, bars / plane labelRole)
 * is not scaled past OPT_IN_TEXT_MAX px: a 'display' headline stops at 1.28x, a 'stat' label (34px) never reaches it.
 * The usual roles (a stat({size: 'display'}) included) are not held back, so a diagram without these options scales as before.
 */
export declare function fillScaleLimit(bands: Band[]): number;
/** A large, atomic value and its muted label. The result is an ordinary plain box, so it works in row(). */
export declare function stat<const Id extends string = never>(value: string | number, label: RichText, opts?: StatOpts & {
    id?: Id;
}): BoxBand & Declares<Id> & HandleOf<Id>;
export declare function banner<const Id extends string = never>(opts: BannerOpts & {
    id?: Id;
}): BannerBand & Declares<Id> & HandleOf<Id>;
export declare function group<C extends Band | Band[], const Id extends string = never>(children: C, opts?: GroupOpts & {
    id?: Id;
}): GroupBand & Declares<IdsOf<C> | Id> & Refers<RefsOf<C>> & HandleOf<Id>;
export declare function legend(items: LegendItem[], opts?: LegendOpts): LegendBand;
export declare function raw(opts: RawOpts): RawBand;

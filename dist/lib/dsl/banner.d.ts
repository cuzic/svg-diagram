import type { Declares, HandleOf } from '../strict.ts';
import type { BannerBand, BannerOpts } from '../types/text-bands.ts';
export declare function banner<const Id extends string = never>(opts: BannerOpts & {
    id?: Id;
}): BannerBand & Declares<Id> & HandleOf<Id>;

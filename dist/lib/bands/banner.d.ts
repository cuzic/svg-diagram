import type { BandDef, WithBandDef } from '../band-def.ts';
import { banner as buildBanner } from '../dsl/banner.ts';
import type { BannerBand, BannerOpts, LaidOutBanner } from '../types/text-bands.ts';
export declare const bannerDefinition: BandDef<BannerBand, LaidOutBanner>;
export declare function banner<const Id extends string = never>(opts: BannerOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof buildBanner<Id>>, LaidOutBanner>;

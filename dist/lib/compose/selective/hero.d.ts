import type { BoxBand } from '../../types/text-bands.ts';
import type { HeroOpts } from '../hero.ts';
export type { HeroOpts, HeroStat } from '../hero.ts';
export declare function hero<C extends BoxBand, const Id extends string = never>(opts: HeroOpts<C, Id>): (import("../../band-def.ts").WithBandDef<import("../../types/text-bands.ts").BannerBand, import("../../types/text-bands.ts").LaidOutBanner> | import("../../band-def.ts").WithBandDef<import("../../types/text-bands.ts").CaptionBand, import("../../types/text-bands.ts").LaidOutCaption> | import("../../band-def.ts").WithBandDef<import("../../dsl-pure.ts").RowBand, import("../../dsl-pure.ts").LaidOutRow>)[];

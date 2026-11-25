import type { BandDef, WithBandDef } from '../band-def.ts';
import type { CaptionBand, CaptionOpts, LaidOutCaption, RichText } from '../types/text-bands.ts';
export declare const captionDefinition: BandDef<CaptionBand, LaidOutCaption>;
export declare function caption(text: RichText, opts?: CaptionOpts): WithBandDef<CaptionBand, LaidOutCaption>;

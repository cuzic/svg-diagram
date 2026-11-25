import type { ToneEnv } from './tokens.ts';
import type { Theme, Roles } from './types/core.ts';
import type { LaidOutBand } from './types/index.ts';
export declare const px: (n: number) => string;
/** The ascent and descent of the primary font at a size: given by the shell (lib/font-box.ts), which reads the font files. */
export type FontBox = (size: number, weight: number, mono: boolean) => {
    ascent: number;
    descent: number;
};
export interface HtmlBandAdapter<T extends LaidOutBand['type'] = LaidOutBand['type']> {
    readonly type: T;
    accepts(band: Extract<LaidOutBand, {
        type: T;
    }>): boolean;
    render(band: Extract<LaidOutBand, {
        type: T;
    }>, day: Theme, tones: ToneEnv, fb: FontBox, roles: Roles, stage?: number): string;
}
export type HtmlAdapters = {
    [T in LaidOutBand['type']]?: HtmlBandAdapter<T>;
};
export declare function htmlAdapterFor(adapters: HtmlAdapters, band: LaidOutBand): HtmlBandAdapter | undefined;
export declare const escapeHtmlText: (s: string) => string;

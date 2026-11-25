import type { Band, LaidOutDiagram } from './types/index.ts';
import type { Finding } from './types/verdicts.ts';
import type { ToneEnv } from './tokens.ts';
import type { Appearance, EmphasisTone, Theme } from './types/core.ts';
import type { LaidOutBanner, LaidOutBox, LaidOutCaption } from './types/text-bands.ts';
export declare function nowrapProblems(b: LaidOutBox): string[];
export declare function boxLikeContrastProblems(band: LaidOutBox | LaidOutBanner | LaidOutCaption, boxTone: EmphasisTone | null, theme: Theme, tones: ToneEnv, appearance?: Appearance): string[];
/** box-size-ignored: box({size}) is read by neither layout nor emit (said once per figure; the band keeps what the author wrote). */
export declare function boxSizeFindings(bands: readonly Band[]): Finding[];
/** stat-fit-shrunk (ADR 0024 D5): a stat() value drawn smaller than its role's size to fit its box. Info: shrinking is the specified behaviour. */
export declare function statFitFindings(d: Partial<Pick<LaidOutDiagram, 'laidOut'>>): Finding[];
export declare const boxLikeRules: Readonly<{
    readonly 'box-size-ignored': {
        readonly doc: 'box({size}) は効果がない(レイアウトも描画も読まない)。大きい文字は役割で書く: stat() / stat({size: "display"})・caption({role: "display"})・banner({headlineRole})・bars / plane({labelRole})。次の版で throw する';
        readonly scope: 'band-grouped';
    };
    readonly 'stat-fit-shrunk': {
        readonly doc: 'stat() の値が箱の幅に収まらないので、自動で小さい文字にした(隣の stat と大きさがそろわない。箱を広げるか、値を短くするとそろう)';
        readonly scope: 'band';
    };
}>;

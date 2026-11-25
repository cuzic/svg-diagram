import type { ToneEnv } from './tokens.ts';
import type { EmphasisTone, Rect, Roles, Theme } from './types/core.ts';
export type BoxLike = Rect & {
    tone?: EmphasisTone;
    dashed?: boolean;
    dim?: boolean; /** ADR 0034: written as `data-node` on the frame */
    dataNode?: string;
};
export declare function frameGeometry(rect: Rect): Rect;
export declare function renderBoxRect(band: BoxLike, day: Theme, tones: ToneEnv, defaultTone: EmphasisTone): string;
export declare function stampGeometry(band: Rect, stampW: number): Rect;
export declare function renderStamp(band: Rect & {
    stamp?: string;
    stampW?: number;
}, roles: Roles): string;
export declare function tagGeometry({ x, y, w, h }: Rect): Rect;

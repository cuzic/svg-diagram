import type { ToneEnv } from './tokens.ts';
import type { LaidOutGroup, LaidOutLegend, LaidOutRow, LaidOutGrid, LaidOutRaw, LaidOutStatus, LaidOutConnect } from './types/containers.ts';
import type { Theme, EmphasisTone, Align, Rect, Roles } from './types/core.ts';
import type { LaidOutPyramid, LaidOutCurve } from './types/figures.ts';
import type { LaidOutPeople, LaidOutDots } from './types/people-dots.ts';
import type { LaidOutSwimlane } from './types/sequence-table-swimlane.ts';
import type { LaidOutBox, LaidOutCaption, LaidOutBanner } from './types/text-bands.ts';
export declare const ringed: (band: LaidOutBox) => boolean;
export declare function renderStepBadge(band: LaidOutBox, day: Theme): string;
export declare function renderBoxIcon(band: LaidOutBox, day: Theme, tones: ToneEnv): string;
export declare function renderCaption(band: LaidOutCaption, day: Theme, tones: ToneEnv): string;
export type BoxLike = Rect & {
    tone?: EmphasisTone;
    dashed?: boolean;
    dim?: boolean; /** ADR 0034: written as `data-node` on the frame */
    dataNode?: string;
};
export declare function renderBoxRect(band: BoxLike, day: Theme, tones: ToneEnv, defaultTone: EmphasisTone): string;
export declare function renderBoxText(band: LaidOutBox | LaidOutBanner, day: Theme, tones: ToneEnv, defaultAlign: Align): string;
export declare function renderTag(band: LaidOutBox, day: Theme, tones: ToneEnv, roles: Roles): string;
export declare function renderStamp(band: Rect & {
    stamp?: string;
    stampW?: number;
}, roles: Roles): string;
export declare function renderBox(band: LaidOutBox, day: Theme, tones: ToneEnv, roles: Roles): string;
export declare function renderGroup(band: LaidOutGroup, day: Theme, tones: ToneEnv, roles: Roles): string;
export declare function renderLegend(band: LaidOutLegend, day: Theme, tones: ToneEnv, roles: Roles): string;
export declare function renderBanner(band: LaidOutBanner, day: Theme, tones: ToneEnv, roles: Roles): string;
export declare function renderRow(band: LaidOutRow, day: Theme, tones: ToneEnv, roles: Roles, stage?: number): string;
export declare function renderGrid(band: LaidOutGrid, day: Theme, tones: ToneEnv, roles: Roles, stage?: number): string;
export declare function renderConnectPath(c: LaidOutConnect): string;
export declare function renderConnect(c: LaidOutConnect, day: Theme, tones: ToneEnv, roles: Roles): string;
export declare function renderPyramid(band: LaidOutPyramid, roles: Roles): string;
export declare function renderPeople(band: LaidOutPeople, day: Theme, tones: ToneEnv): string;
export declare function renderDots(band: LaidOutDots, day: Theme, tones: ToneEnv): string;
export declare function renderCurve(band: LaidOutCurve, day: Theme, tones: ToneEnv): string;
/**
 * The status badge (diagram({status})): one accessible unit, a dashed outline (not colour alone says "draft"), bold text. Colours are
 * tokens, so appearance: 'dark' recolours it like everything else; `danger` is not used (it means "an example not to follow").
 */
export declare function renderStatus(band: LaidOutStatus): string;
export declare function renderRaw(band: LaidOutRaw, day: Theme): string;
export declare function renderSwimlane(b: LaidOutSwimlane, day: Theme, roles: Roles): string;

import type { LayoutCtx } from './layout-ctx.ts';
import type { GroupBand } from './types/containers.ts';
/** A group stretched taller than its content by a row (ADR 0014 D2): the room to hand to the content, and where it goes. */
export interface GroupFill {
    slack: number;
    valign: 'center' | 'stretch';
}
/** Least room (px) a row's stretch must leave a group's content before the content is moved: under it, the content stays at the top. */
export declare const GROUP_FILL_MIN = 16;
/**
 * How `slack` px are shared inside a group of `n` children: each of the n-1 gaps grows by up to 16px (in 4px steps), and what is
 * still left is split above and below, the top part on the grid.
 */
export declare function groupFillPlan(n: number, slack: number): {
    top: number;
    gap: number;
};
export declare function layoutGroup(band: GroupBand, ctx: LayoutCtx, padX: number, cw: number): void;
export declare function layoutGroupAt(band: GroupBand, ctx: LayoutCtx, padX: number, cw: number, fill?: GroupFill): void;

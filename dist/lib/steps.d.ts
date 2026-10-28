import type { LoopBack, RowBand } from './types/containers.ts';
import type { TagTone } from './types/core.ts';
import type { BoxTone } from './types/text-bands.ts';
import type { IconName } from './icons.ts';
import type { Declares, RowHandleOf } from './strict.ts';
/** One step of steps(): what happened, in a box with an optional icon, body and tag. */
export interface StepItem {
    title: string;
    body?: string;
    icon?: IconName;
    tag?: string;
    tagTone?: TagTone;
    tone?: BoxTone;
}
export interface StepsOpts {
    /** Number the steps 1, 2, 3 ... with a badge on each title (default false). */
    numbered?: boolean;
    /** The 1-based step to emphasise (one only). */
    highlight?: number;
    /** The tone of the highlighted step (default 'danger'). */
    highlightTone?: 'danger' | 'accent';
    /** Arrows between the boxes (default true). */
    arrows?: boolean;
    gap?: number;
    /** Makes the row an anchor (`id#2` is the second step), like row({id}). */
    id?: string;
    /** The arrows back to earlier steps, drawn under the boxes: `{from: 4, to: 2, label: '差し戻し'}` (1-based step numbers). Several loops must nest. */
    loopBack?: LoopBack | readonly LoopBack[];
}
/**
 * Things that happened in order, with no dates: a row of boxes (number badge, icon, title, body, tag) joined by arrows, one of them
 * optionally emphasised. It is an ordinary row(), so connect() / spotlight / reveal-by-child work as for a row.
 *   steps([{title: '再発', body: '1回目'}, {title: '再発'}, {title: '遮断', icon: 'shield'}], {numbered: true, highlight: 3})
 */
export declare function steps<const Id extends string = never>(items: StepItem[], opts?: StepsOpts & {
    id?: Id;
}): RowBand & Declares<Id> & RowHandleOf<Id>;

import type { Ctx } from './adapter.ts';
import type { TextBox } from './shapes.ts';
import type { Rect } from './xml.ts';
/** A box's text, its lines joined: what it is named by (ADR 0054 D7). */
export declare const textOf: (b: TextBox) => string;
export declare function boxBadge(ctx: Ctx, tone: TextBox['tone'], text: string, rect: Rect, name: string): string;
export declare function stampBadge(ctx: Ctx, box: Rect & {
    stampW?: number;
    tone?: TextBox['tone'];
}, stamp: string): string;

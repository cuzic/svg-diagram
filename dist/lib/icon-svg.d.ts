import type { IconGlyph } from './icon-store.ts';
export interface IconDraw {
    glyph: IconGlyph;
    name: string;
    x: number;
    y: number;
    size: number;
    /** The colour (a token colour). */
    color: string;
    /** Faded when the thing it belongs to is dimmed (only a fixed-colour icon: the others are already muted). */
    dim?: boolean;
    /** With a label beside it the icon is decoration (`aria-hidden`); alone it is `role="img"` with its name. */
    labelled: boolean;
}
export declare function iconSvg(o: IconDraw): string;

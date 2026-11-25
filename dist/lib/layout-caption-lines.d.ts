import type { DiagramData } from './types/core.ts';
/** diagram({showTitle}) puts the title first, drawn like a group's title (bold, left, title size). A copy; without showTitle, the input itself. */
export declare function withTitleLine(d: DiagramData): DiagramData;
/**
 * diagram({sourceLine}) is always the last band: left-aligned, muted, note size, whatever was add()ed and in whatever order.
 * Returns a copy (the input is not changed); without a sourceLine, the input itself.
 */
export declare function withSourceLine(d: DiagramData): DiagramData;

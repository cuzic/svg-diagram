import { type ToneEnv } from '../tokens.ts';
import type { LaidOutDiagram } from '../types/index.ts';
import type { LaidOutCause } from '../types/diagrams.ts';
import { type Pt } from './geom.ts';
import type { Fonts, Rect } from './xml.ts';
/** The arrow colour of a figure with `focus` (ADR 0051): lit (it touches a focused item) in the accent colour, the others muted. */
export declare function focusColor(focused: readonly string[] | undefined, day: LaidOutDiagram['day'], plain: string): (from: string, to: string) => string;
/** Where the core driver's badge goes: just outside the side away from the arrows that leave it (as lib/emit-figures.ts coreBadge). */
export declare function coreBadgeRect(n: Rect, leave: Pt | undefined): Rect;
export interface CauseShapes {
    xml: string;
    glue: {
        dslId: string;
        id: number;
        rect: Rect;
    }[];
}
export declare function causeXml(b: LaidOutCause, ld: LaidOutDiagram, tones: ToneEnv, fonts: Fonts, next: () => number): CauseShapes;

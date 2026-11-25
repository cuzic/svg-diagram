import { type ToneEnv } from '../tokens.ts';
import type { LaidOutDiagram } from '../types/index.ts';
import type { LaidOutQuadrant, QuadrantShape } from '../quadrant.ts';
import { type Fonts, type Rect } from './xml.ts';
/** A marker of area pi r^2 centred at (x, y), as the svg draws it: the preset and the box that holds it. */
export declare function markerShape(shape: QuadrantShape, x: number, y: number, r: number): {
    prst: string;
    rect: Rect;
};
/** Whether a part path is (inside) an item's part: by its steps' kinds, not by a search of the text (a caption may hold "item:"). */
export declare const inItem: (part: string | undefined) => boolean;
export interface QuadrantShapes {
    xml: string;
    glue: {
        dslId: string;
        id: number;
        rect: Rect;
    }[];
}
export declare function quadrantXml(b: LaidOutQuadrant, ld: LaidOutDiagram, tones: ToneEnv, fonts: Fonts, next: () => number): QuadrantShapes;

import { type ToneEnv } from '../tokens.ts';
import type { LaidOutDiagram } from '../types/index.ts';
import type { LaidOutStates } from '../types/diagrams.ts';
import type { Fonts, Rect } from './xml.ts';
export interface StatesShapes {
    xml: string;
    glue: {
        dslId: string;
        id: number;
        rect: Rect;
    }[];
}
export declare function statesXml(b: LaidOutStates, ld: LaidOutDiagram, tones: ToneEnv, fonts: Fonts, next: () => number): StatesShapes;

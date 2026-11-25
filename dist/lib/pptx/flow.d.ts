import { type ToneEnv } from '../tokens.ts';
import type { LaidOutDiagram } from '../types/index.ts';
import type { LaidOutFlowShape } from '../flow-shapes.ts';
import type { Fonts, Rect } from './xml.ts';
export interface DrawnShapes {
    xml: string;
    glue: {
        dslId: string;
        id: number;
        rect: Rect;
    }[];
}
export declare function flowShapeXml(b: LaidOutFlowShape, ld: LaidOutDiagram, tones: ToneEnv, fonts: Fonts, next: () => number): DrawnShapes;

import { type ToneEnv } from '../tokens.ts';
import type { LaidOutDiagram } from '../types/index.ts';
import type { LaidOutFlowShape } from '../flow-shapes.ts';
import type { LaidOutPyramid } from '../types/figures.ts';
import type { LaidOutTimeline } from '../types/timeline.ts';
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
/** A pyramid: each layer a trapezoid in the accent colour at its opacity, holding its lines. */
export declare function pyramidXml(b: LaidOutPyramid, ld: LaidOutDiagram, fonts: Fonts, next: () => number): string;
/** A timeline: the axis, ticks, stems and guides as lines, the span and bars as rectangles (a bar holding the texts inside it), dots as circles, any other text a text box. */
export declare function timelineXml(b: LaidOutTimeline, ld: LaidOutDiagram, fonts: Fonts, next: () => number): string;

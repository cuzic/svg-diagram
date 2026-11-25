import type { LaidOutTimeline } from '../types/timeline.ts';
import type { LaidOutDiagram } from '../types/index.ts';
import type { Fonts } from './xml.ts';
/** A timeline: the axis, ticks, stems and guides as lines, the span and bars as rectangles (a bar holding the texts inside it), dots as circles, any other text a text box. */
export declare function timelineXml(b: LaidOutTimeline, ld: LaidOutDiagram, fonts: Fonts, next: () => number): string;

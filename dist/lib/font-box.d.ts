import type { FontBox } from './emit-html.ts';
import type { MeasureSettings } from './types/core.ts';
/** The glyph boxes for a diagram measured with `settings` (default: the process default). */
export declare function fontBoxOf(settings?: MeasureSettings): FontBox;

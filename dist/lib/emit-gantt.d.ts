import type { Rect, Theme } from './types/core.ts';
import type { LaidOutGantt } from './types/timeline.ts';
export declare function ganttBarGeometry({ x, y, w, h }: Rect): Rect;
export declare function renderGantt(b: LaidOutGantt, day: Theme): string;

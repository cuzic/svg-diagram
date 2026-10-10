import type { DiagramData, LaidOutDiagram } from './types.ts';
export declare const LINE_HEIGHT_EM = 1.4;
export declare const BOX_PAD_X = 20;
export declare const BOX_PAD_Y = 16;
export declare const BOX_INNER_GAP = 8;
export declare const STEP_BADGE_R = 15;
export declare const STEP_BADGE_BASELINE_OFFSET = 6;
export declare const LEGEND_SWATCH_W = 36, LEGEND_ITEM_GAP = 28, LEGEND_ROW_H = 24;
export declare function layoutDiagram(d: DiagramData): Promise<LaidOutDiagram>;

import type { LaidOutBand, LaidOutDiagram } from './types/index.ts';
export declare function withNodeIdsBand(band: LaidOutBand): LaidOutBand;
/** The laid-out diagram with the names of its nodes on them. */
export declare const withNodeIds: (d: LaidOutDiagram) => LaidOutDiagram;

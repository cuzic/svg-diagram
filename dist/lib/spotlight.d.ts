import type { DiagramData } from './types/core.ts';
import type { Band, LaidOutDiagram } from './types/index.ts';
export declare function spotlightIds(d: Pick<DiagramData, 'spotlight'>): string[];
/** How a bar outside the spotlight is drawn: a dotted outline (default) or a pale fill. */
export declare function spotlightDim(d: Pick<DiagramData, 'spotlight'>): 'outline' | 'fill';
export declare function spotlightEdges(d: Pick<DiagramData, 'spotlight'>): 'touching' | 'between';
/** Input bands outside the spotlight. Used before layout so auto legends ignore their notation. */
export declare function dimmedBands(d: Pick<DiagramData, 'bands' | 'spotlight'>): Set<Band>;
/** Adds the internal dim flag after geometry is fixed; coordinates and existing diagrams stay untouched. */
export declare function applySpotlight(d: LaidOutDiagram): void;

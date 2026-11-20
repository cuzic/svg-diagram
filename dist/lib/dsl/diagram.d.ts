import type { Diagram, DiagramData } from '../types/core.ts';
import type { LaidOutDiagram } from '../types/index.ts';
import type { DiagramInput } from '../strict.ts';
export declare function diagram(opts: DiagramInput): Diagram<never>;
/** What the passes may write into: the bands are copied, so a band shared by two diagrams (or drawn twice) is never changed by a render. */
export declare function detachData<D extends DiagramData>(d: D): D;
/**
 * The layout, and for diagram({width: 'fit'}) once more at the width the content needs (`d.width` is set to it). The content may re-flow as it
 * narrows, so up to 3 rounds; a round that does not fit is dropped. check and build both come through here, so they judge the same figure.
 */
export declare function layoutFitted(d: DiagramData, layout: () => Promise<LaidOutDiagram>): Promise<LaidOutDiagram>;

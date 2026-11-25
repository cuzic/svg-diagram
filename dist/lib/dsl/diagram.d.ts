import type { Diagram, DiagramData } from '../types/core.ts';
import type { DiagramInput } from '../strict.ts';
export { layoutFitted } from '../layout-fit-width.ts';
export declare function diagram(opts: DiagramInput): Diagram<never>;
/** What the passes may write into: the bands are copied, so a band shared by two diagrams (or drawn twice) is never changed by a render. */
export declare function detachData<D extends DiagramData>(d: D): D;

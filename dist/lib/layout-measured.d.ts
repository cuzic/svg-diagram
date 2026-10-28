import type { DiagramData, MeasureSettings, Roles } from './types/core.ts';
import type { LaidOutDiagram } from './types/index.ts';
/** Measure then lay out. `roles` (default ROLES) is baked into the result as LaidOutDiagram.roles; the measuring settings (`measure`, else
 *  the diagram's own, else the process default) are baked in as LaidOutDiagram.measure, which the HTML emit measures glyph boxes with. */
export declare function layoutDiagram(d: DiagramData, opts?: {
    roles?: Roles;
    measure?: MeasureSettings;
}): Promise<LaidOutDiagram>;

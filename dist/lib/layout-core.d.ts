import type { fitLineScale } from './layout-cause-fit.ts';
import type { BandLayoutHandler } from './layout-ctx.ts';
import type { layoutBoxLike } from './layout-box-like.ts';
import type { resolveConnect } from './layout-connect.ts';
import type { prepareConnectorGaps } from './layout-connect-gaps.ts';
import type { ScopeTable } from './scope-table.ts';
import type { ContentInventory } from './types/inventory.ts';
import type { AreasBand, LaidOutConnect } from './types/containers.ts';
import type { areasPrelayout } from './layout-areas-gaps.ts';
import type { DiagramData, Roles, WidthOf } from './types/core.ts';
import type { LaidOutDiagram, LaidOutBand, Band } from './types/index.ts';
export interface LayoutServices {
    layoutBoxLike?: typeof layoutBoxLike;
    fitLineScale?: typeof fitLineScale;
    offGrid?: (band: Band) => boolean;
    decorate?: (data: DiagramData) => DiagramData;
    resolveConnect: typeof resolveConnect;
    resolve: (band: Band) => BandLayoutHandler<never>;
    hasChildrenHandler: (band: Band) => boolean;
    childrenOf: (band: Band) => Band[];
    stackWidthOf: (band: Band, width: number) => number | null;
    connectorGaps?: typeof prepareConnectorGaps;
    areasPrelayoutFor?: (band: AreasBand) => typeof areasPrelayout | undefined;
    scopesOf: (bands: readonly Band[]) => ScopeTable;
    buildInventory: (bands: LaidOutBand[], connects: LaidOutConnect[], widthOf: WidthOf, labelSize?: number) => ContentInventory;
}
/** Pass 2, synchronous: lay the diagram out with the widths already measured. */
export declare function createLayoutWith(services: LayoutServices): (data: DiagramData, roles: Roles, widthOf: WidthOf) => LaidOutDiagram;

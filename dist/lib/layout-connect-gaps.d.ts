import type { LayoutServices } from './layout-core.ts';
import type { RowLike } from './layout-ctx.ts';
import type { AreasBand, ConnectBand } from './types/containers.ts';
import type { Roles, WidthOf } from './types/core.ts';
import type { Band } from './types/index.ts';
type GapServices = Pick<LayoutServices, 'childrenOf' | 'stackWidthOf' | 'areasPrelayoutFor'>;
/** Find space for straight connector labels before laying out the participating bands (ADR 0069). */
export declare function prepareConnectorGaps({ childrenOf, stackWidthOf, areasPrelayoutFor }: GapServices, bands: Band[], labelled: readonly ConnectBand[], contentWidth: number, stackGap: number, roles: Roles, widthOf: WidthOf): {
    gapForLabels: (band: RowLike, cw: number) => number;
    areasGapFor: (band: AreasBand, cw: number) => {
        gap: number;
        rowGap: number;
    };
    bandGaps: Map<Band, number>;
};
export {};

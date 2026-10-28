import type { LayeredLayout } from './graph-layout.ts';
/**
 * A figure too tall for its height budget (its layers lie along the height): the boundary between two layers where both halves fit the budget, with the
 * fewest arrows across it, then the most even number of nodes. `lay` is in layout coordinates, the layers along x. A return (a reversed edge) is not counted.
 * None fits: say that three or more figures are needed.
 */
export declare function splitByHeight(lay: LayeredLayout, budget: number): string | undefined;
/** A figure too wide (one layer is wider than the figure): that layer and its nodes. A cut between layers does not help; the layer has to be shared out between two figures. */
export declare function splitWidest(lay: LayeredLayout): string | undefined;

import type { ChartBand } from '../charts.ts';
import type { PertTask } from '../semnet-critical-path.ts';
import type { PertOpts } from '../semnet.ts';
import type { AnchorsOf, Declares, HandleOf } from '../strict.ts';
import type { ChartIds } from './chart-ids.ts';
/** A PERT / activity-on-node arrow diagram. Timing and zero-slack critical paths are calculated from predecessors. */
export declare function pert<const T extends readonly PertTask[], const Id extends string = never>(tasks: T, opts?: PertOpts & {
    id?: Id;
}): ChartBand & Declares<Id | ChartIds<T>> & HandleOf<Id> & AnchorsOf<ChartIds<T>>;

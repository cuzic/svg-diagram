import type {ChartBand} from '../charts.ts';
import {pertBand} from '../semnet-dsl.ts';
import type {PertTask} from '../semnet-analysis.ts';
import type {PertOpts} from '../semnet.ts';
import type {AnchorsOf, Declares, HandleOf} from '../strict.ts';
import {withAnchors, withHandle} from './shared.ts';
import type {ChartIds} from './chart-ids.ts';

/** A PERT / activity-on-node arrow diagram. Timing and zero-slack critical paths are calculated from predecessors. */
export function pert<const T extends readonly PertTask[], const Id extends string = never>(tasks: T, opts?: PertOpts & {id?: Id}): ChartBand & Declares<Id | ChartIds<T>> & HandleOf<Id> & AnchorsOf<ChartIds<T>>;
export function pert(tasks: readonly PertTask[], opts: PertOpts = {}): ChartBand { const band = pertBand(tasks, opts); return withHandle(withAnchors(band, band.ids), opts.id); }

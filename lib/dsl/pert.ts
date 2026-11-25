import type {ChartBand} from '../charts.ts';
import {pertAlt, resolvePert} from '../semnet-pert.ts';
import {semnetBandOptions} from '../semnet-band-options.ts';
import type {PertTask} from '../semnet-critical-path.ts';
import type {PertOpts} from '../semnet.ts';
import type {AnchorsOf, Declares, HandleOf} from '../strict.ts';
import {withAnchors, withHandle} from './shared.ts';
import type {ChartIds} from './chart-ids.ts';

function pertBand(tasks: readonly PertTask[], opts: PertOpts = {}): ChartBand {
  const spec = resolvePert(tasks, opts);
  return {type: 'chart', kind: 'pert', spec, alt: opts.alt ?? pertAlt(spec), ids: tasks.map(t => t.id), ...semnetBandOptions(opts)};
}

/** A PERT / activity-on-node arrow diagram. Timing and zero-slack critical paths are calculated from predecessors. */
export function pert<const T extends readonly PertTask[], const Id extends string = never>(tasks: T, opts?: PertOpts & {id?: Id}): ChartBand & Declares<Id | ChartIds<T>> & HandleOf<Id> & AnchorsOf<ChartIds<T>>;
export function pert(tasks: readonly PertTask[], opts: PertOpts = {}): ChartBand {
  const band = pertBand(tasks, opts);
  return withHandle(withAnchors(band, band.ids), opts.id);
}

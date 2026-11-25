import {scatterOpts} from '../qc-plane.ts';
import type {ScatterOpts, ScatterPoint} from '../qc-plane.ts';
import type {PlaneBand} from '../types/figures.ts';
import {plane} from './plane.ts';
import type {Declares, HandleOf} from '../strict.ts';

/**
 * A scatter diagram (散布図): the axes fit the data, each stratum (`group`) has its own colour and shape, and `regression: true` draws
 * the least-squares line with the correlation coefficient r.
 *   scatter([{x: 20, y: 3.1}, {x: 25, y: 3.8}, ...], {x: '温度 (℃)', y: '不良率 (%)', regression: true})
 */
export function scatter<const Id extends string = never>(points: readonly ScatterPoint[], opts: ScatterOpts & {id?: Id}): PlaneBand & Declares<Id> & HandleOf<Id>;
export function scatter(points: readonly ScatterPoint[], opts: ScatterOpts): PlaneBand {
  if (!opts?.x || !opts?.y) throw new Error("scatter(points, {x, y}) needs the axes' names: {x: '温度', y: '不良率'}");
  return plane(scatterOpts(points, opts)) as PlaneBand;
}

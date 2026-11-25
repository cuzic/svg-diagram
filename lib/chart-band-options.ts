import {assertScope} from './scope-name.ts';
import {fail} from './charts-base.ts';
import type {ChartOpts} from './charts-base.ts';
import type {ChartBand} from './charts.ts';

export function chartBandOptions(who: string, opts: ChartOpts): Pick<ChartBand, 'id' | 'width' | 'height' | 'labelRole' | 'scope' | 'reveal' | 'until'> {
  assertScope(opts.scope, `${who}()`);
  if (opts.labelRole !== undefined && !['note', 'banner', 'stat'].includes(opts.labelRole)) fail(who, `labelRole must be note, banner or stat (got ${String(opts.labelRole)})`);
  for (const k of ['width', 'height'] as const) if (opts[k] !== undefined && !(Number.isFinite(opts[k]) && (opts[k] as number) > 0)) fail(who, `${k} must be a number > 0 (got ${opts[k]})`);
  return {
    ...(opts.id === undefined ? {} : {id: opts.id}), ...(opts.width === undefined ? {} : {width: opts.width}), ...(opts.height === undefined ? {} : {height: opts.height}),
    ...(opts.labelRole === undefined ? {} : {labelRole: opts.labelRole}), ...(opts.scope === undefined ? {} : {scope: opts.scope}), ...(opts.reveal === undefined ? {} : {reveal: opts.reveal}), ...(opts.until === undefined ? {} : {until: opts.until}),
  };
}

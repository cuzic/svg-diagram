
import type {RowBand} from '../types/containers.ts';
import type {Band} from '../types/index.ts';
import {group} from './group.ts';
import {row} from './row.ts';
import {chartAxes} from '../charts.ts';
import type {ChartBand} from '../charts.ts';

export interface FacetOpts {
  /** Panels per row (default 2). The last row keeps the same column width. */
  cols?: number;
  /** Draw a frame (with the panel's name as its title) around each panel (default true; false: only the name above). */
  frame?: boolean;
  /**
   * Which axes the panels share (as seaborn's sharex / sharey): 'xy' (default), 'x', 'y' or 'none'. The panels are drawn once to see their axes,
   * then again with the combined range handed to `make` as its 4th argument (`{xRange, yRange}`: spread it into the chart's options). Only
   * histplot / kdeplot / ecdfplot / displot / regplot / residplot panels have axes to share; by default other panels are left alone,
   * and an explicit 'x' / 'y' / 'xy' with no such panel is an error.
   */
  share?: 'xy' | 'x' | 'y' | 'none';
}
/** The axes a facet() hands to `make` so that the panels agree. */
export interface FacetAxes {xRange?: [number, number]; yRange?: [number, number]}
/**
 * パネル分割 (seaborn FacetGrid / relplot / catplot's col=): one panel per key of `data`, each drawn by `make`, titled with the key, laid out in rows.
 * The panels share their axes (`share`): pass the 4th argument on to the chart.
 *   .add(...facet({東京: a, 大阪: b, 名古屋: c}, (name, values, _i, axes) => histplot(values, {...axes}), {cols: 3}))
 */
export function facet<T>(data: Readonly<Record<string, T>>, make: (key: string, value: T, index: number, axes: FacetAxes) => Band, opts: FacetOpts = {}): RowBand[] {
  const entries = Object.entries(data), cols = opts.cols ?? 2, share = opts.share ?? 'xy';
  if (entries.length === 0) throw new Error('facet(data) needs at least one panel');
  if (!Number.isInteger(cols) || cols < 1) throw new Error(`facet(): cols must be a whole number >= 1 (got ${opts.cols})`);
  if (!['xy', 'x', 'y', 'none'].includes(share)) throw new Error(`facet(): share must be xy, x, y or none (got ${String(opts.share)})`);
  let axes: FacetAxes = {};
  if (share !== 'none') {
    const seen = entries.map(([key, value], i) => { const b = make(key, value, i, {}); return b.type === 'chart' ? chartAxes(b as ChartBand) : undefined; }).filter((a): a is NonNullable<typeof a> => a !== undefined);
    if (seen.length === 0) {
      if (opts.share !== undefined) throw new Error('facet(): share needs histplot / kdeplot / ecdfplot / displot / regplot / residplot panels (the others have no axis range to share)');
    } else {
      const span = (k: 'x' | 'y'): [number, number] => [Math.min(...seen.map(a => a[k][0])), Math.max(...seen.map(a => a[k][1]))];
      axes = {...(share.includes('x') ? {xRange: span('x')} : {}), ...(share.includes('y') ? {yRange: span('y')} : {})};
    }
  }
  const panels = entries.map(([key, value], i) => group(make(key, value, i, axes) as never, {title: key, span: 1, ...(opts.frame === false ? {frame: false} : {})}));
  const rows: RowBand[] = [];
  for (let i = 0; i < panels.length; i += cols) rows.push(row(panels.slice(i, i + cols) as never, {cols}) as never);
  return rows;
}

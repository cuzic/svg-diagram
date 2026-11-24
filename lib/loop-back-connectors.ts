import {connectBand} from './dsl/defaults.ts';
import type {LoopBackSource} from './loop-back-source.ts';
import {sourceOf, withSource} from './source-ref.ts';
import type {ConnectBand, LoopBack} from './types/containers.ts';

/** The height of the first loop under the boxes, and how much each loop outside it adds (px). */
const DIP = 32, LANE = 28;

/** Turn validated loops into connectors, with shorter spans placed nearer their steps. */
export function loopBackConnectors(
  band: {id?: string}, {loops, anchor}: LoopBackSource, nextId: () => string,
): ConnectBand[] {
  const id = band.id ?? (band.id = nextId());
  const byLane = (Array.isArray(loops) ? loops as readonly LoopBack[] : [loops as LoopBack])
    .toSorted((x, y) => ((x.from as number) - (x.to as number)) - ((y.from as number) - (y.to as number)));
  const ref = sourceOf(band);
  return byLane.map((l, lane) => withSource(Object.assign(connectBand(`${anchor(id, l.from as number)}:bottom`, `${anchor(id, l.to as number)}:bottom`, {
    route: 'loop-under', dip: DIP + lane * LANE, ...(l.label === undefined ? {} : {label: l.label}), ...(l.chip === undefined ? {} : {chip: l.chip}), ...(l.tone === undefined ? {} : {tone: l.tone}), ...(l.line === undefined ? {} : {line: l.line}),
  }, false), {loopBack: true as const}), ref));
}

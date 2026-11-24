import type {SvgBandDefs} from './emit-svg-core.ts';
import type {WrappedRun} from './types/text-bands.ts';

export function textSvgDefs(band: {wrappedRuns: readonly WrappedRun[]}): SvgBandDefs {
  return {mono: band.wrappedRuns.some(run => run.mono)};
}

export function childTextSvgDefs(band: {children: readonly {wrappedRuns: readonly WrappedRun[]}[]}): SvgBandDefs {
  return {mono: band.children.some(child => textSvgDefs(child).mono)};
}

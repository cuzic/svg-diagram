import {band} from './band-def.ts';
import type {BandDef, WithBandDef} from './band-def.ts';
import {stateMatrix as buildMatrix} from './dsl/sequence-table-swimlane.ts';
import {stateMatrixFindings} from './state-matrix-rules.ts';
import {screens as build} from './dsl/wireframe.ts';
import {renderPrims} from './emit-tables.ts';
import type {ScreensItemInput, StateRowLoose, ValidateStateRows} from './strict.ts';
import type {LaidOutScreens, PartRow, ScreensBand, ScreensOpts, StateMatrixOpts} from './types/wireframe.ts';
import {frameRects} from './verify-rects.ts';
import type {BandLayoutHandler} from './layout-ctx.ts';
import type {TextRequest} from './types/core.ts';

export function screensFor(collect: (data: ScreensBand) => TextRequest[], place: BandLayoutHandler<ScreensBand>) {
  const definition = {
    type: 'screens',
    offGrid: true,
    internal: true,
    layout: place,
    ids: data => data.items.flatMap(item => item.id ? [item.id] : []),
    measure(data, {atoms}) {
      for (const [text, size, weight, font] of collect(data)) atoms(text, size, weight, font);
    },
    emit: (laid, {theme}) => renderPrims(laid, theme),
    verify: {rects: frameRects, findings: stateMatrixFindings},
  } satisfies BandDef<ScreensBand, LaidOutScreens>;

  function screens<const Id extends string = never>(items: ScreensItemInput<Id>[], opts?: ScreensOpts): WithBandDef<ReturnType<typeof build<Id>>, LaidOutScreens> {
    const data = build<Id>(items, opts);
    return band<typeof data, LaidOutScreens>(definition, data);
  }

  function stateMatrix<const C extends string[], const R extends readonly (StateRowLoose | PartRow<never, string>)[]>(
    cols: C, rows: readonly [...R] & ValidateStateRows<C, R>, opts?: Omit<StateMatrixOpts, 'required'> & {required?: C[number][]},
  ): WithBandDef<ScreensBand, LaidOutScreens> {
    return band<ScreensBand, LaidOutScreens>(definition, buildMatrix<C, R>(cols, rows, opts));
  }
  return {screens, stateMatrix};
}

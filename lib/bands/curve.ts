import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {curve as build} from '../dsl/curve.ts';
import {renderCurve} from '../emit-boxes.ts';
import {layoutCurve} from '../layout-curve.ts';
import type {CurvePoints} from '../strict.ts';
import type {CurveBand, CurveOpts, LaidOutCurve} from '../types/figures.ts';

const definition = {
  type: 'curve',
  internal: true,
  layout: layoutCurve,
  measure(data, {atoms, roles}) {
    for (const label of [data.yTopLabel, data.yBottomLabel, data.xLabel]) if (label) atoms(label, roles.note, 400);
  },
  emit: (laid, env) => renderCurve(laid, env.theme, env.tones),
} satisfies BandDef<CurveBand, LaidOutCurve>;

export function curve(points: CurvePoints, opts?: CurveOpts): WithBandDef<CurveBand, LaidOutCurve> {
  return band<CurveBand, LaidOutCurve>(definition, build(points, opts));
}

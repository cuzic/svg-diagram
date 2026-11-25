import type { BandDef, WithBandDef } from '../band-def.ts';
import type { CurvePoints } from '../strict.ts';
import type { CurveBand, CurveOpts, LaidOutCurve } from '../types/figures.ts';
export declare function curve(points: CurvePoints, opts?: CurveOpts): WithBandDef<CurveBand, LaidOutCurve>;
/** @internal Definition used by the full renderer. */
export declare const curveDefinition: BandDef<CurveBand, LaidOutCurve>;

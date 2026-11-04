// The single place a new band kind can be registered for all 7 per-band-type tables at once (childBands / stackWidth / layout /
// measure / emit / fit / verify / reveal — band-children.ts, layout-handlers.ts, layout-measure.ts, emit-handlers.ts,
// fit-handlers.ts, verify-handlers.ts, reveal-handlers.ts), instead of adding one line to each file separately.
//
// To add a new band: write one BandSpec with defineBand() (see curveSpec below for a worked example — curve() was migrated
// here to prove the mechanism) and list it in REGISTERED_BAND_SPECS. Each of the 7 table files merges
// `byType(REGISTERED_BAND_SPECS, '<field>')` into its existing literal table, so a band registered only here still
// participates in that table's compile-time completeness check (UnhandledBandTypes / ALL_BANDS_* below it) and in the
// runtime cross-checks (test/band-registries.test.ts, test/reveal-handlers.test.ts).
//
// `spacer` / `connect` / `grouprow` are not covered: they are special structural band types (in Band['type'] but not
// LaidOutType — resolved around/before normal layout, not "a figure with 8 handlers"), unlikely to gain siblings, and stay
// hand-wired in their tables.
//
// This file depends only on leaf modules (types, tokens, layout-util, emit-common, verify-base) — never on the 7 table files
// themselves or on anything that reaches back into them (e.g. emit-boxes.ts, which pulls in reveal.ts -> reveal-handlers.ts),
// so the table files can import REGISTERED_BAND_SPECS / byType from here without a circular value import.

import {PALETTE, colorOf, toneStyle} from './tokens.ts';
import {snap4, escapeXml} from './emit-common.ts';
import {labelOf} from './verify-base.ts';
import {snapGrid} from './layout-util.ts';
import type {Theme} from './types/core.ts';
import type {ToneEnv} from './tokens.ts';
import type {Band} from './types/index.ts';
import type {LaidOutType, LaidOutOf} from './band-table.ts';
import type {ChildBandsTable, StackWidthTable} from './band-children.ts';
import type {BandLayoutHandler, LayoutCtx} from './layout-ctx.ts';
import type {MeasureHandler} from './layout-measure.ts';
import type {EmitHandler} from './emit-handlers.ts';
import type {TextSizes} from './fit-handlers.ts';
import type {VerifyHandler} from './verify-handlers.ts';
import type {RevealHandler} from './reveal-handlers.ts';
import type {CurveBand, LaidOutCurve} from './types/figures.ts';

type BandOf<T extends Band['type']> = Extract<Band, {type: T}>;

/** Every handler a band of type T needs, bundled as one object instead of eight. */
export interface BandSpec<T extends LaidOutType> {
  type: T;
  childBands: ChildBandsTable[T];
  stackWidth: StackWidthTable[T];
  layout: BandLayoutHandler<BandOf<T>>;
  measure: MeasureHandler<BandOf<T>>;
  emit: EmitHandler<LaidOutOf<T>>;
  fit: TextSizes<LaidOutOf<T>>;
  verify: VerifyHandler<LaidOutOf<T>>;
  reveal: RevealHandler<BandOf<T>>;
}

/** Type-inference anchor: write defineBand('wordart', {...}) and every field is checked against that one band type. */
export function defineBand<T extends LaidOutType>(type: T, spec: Omit<BandSpec<T>, 'type'>): BandSpec<T> {
  return {type, ...spec};
}

/**
 * Rebuilds one table ({type -> handler}) from the registry, keeping each entry's own literal type — so spreading this into
 * an existing hand-written table (`{...legacy, ...byType(REGISTERED_BAND_SPECS, 'layout')} satisfies XxxTable`) still makes
 * a band type with no entry anywhere a compile error, exactly as a single hand-written table does today.
 */
export function byType<const Specs extends readonly {type: string}[], K extends keyof Specs[number]>(
  specs: Specs, key: K,
): {[S in Specs[number] as S['type']]: S[K]} {
  return Object.fromEntries(specs.map(s => [s.type, (s as Record<K, unknown>)[key]])) as never;
}

// ---- worked example: curve() ----

function layoutCurve(band: CurveBand, ctx: LayoutCtx, padX: number, cw: number): void {
  const {d} = ctx;
  const w = band.width ?? cw;
  const h = band.height;
  const x = padX + (cw - w) / 2;
  const y = snapGrid(ctx.y);
  const AXIS_LABEL_W = 44, AXIS_BOTTOM_GAP = 28, TOP_PAD = 14, RIGHT_PAD = 8;
  const axisX = x + AXIS_LABEL_W;
  const axisRight = x + w - RIGHT_PAD;
  const axisTop = y + TOP_PAD;
  const axisBottom = y + h - AXIS_BOTTOM_GAP;
  const n = band.points.length;
  const points = band.points.map((p, i) => ({
    x: n === 1 ? axisX : axisX + i * (axisRight - axisX) / (n - 1),
    y: axisBottom - Math.max(0, Math.min(1, p.y)) * (axisBottom - axisTop),
    emphasis: p.emphasis,
    dropLine: !!p.dropLine,
  }));
  ctx.laidOut.push({
    type: 'curve', x, y, w, h, axisX, axisRight, axisTop, axisBottom, points,
    yTopLabel: band.yTopLabel, yBottomLabel: band.yBottomLabel, xLabel: band.xLabel,
  });
  ctx.y += h + d.gap;
}

function renderCurve(band: LaidOutCurve, day: Theme, tones: ToneEnv): string {
  const parts: string[] = [];
  parts.push(`<path d="M${Math.round(band.axisX)},${Math.round(band.axisTop)} L${Math.round(band.axisX)},${Math.round(band.axisBottom)} L${Math.round(band.axisRight)},${Math.round(band.axisBottom)}" fill="none" stroke="${PALETTE.text}" stroke-width="2"/>`);
  parts.push(`<path d="${band.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${Math.round(p.x)},${Math.round(p.y)}`).join(' ')}" fill="none" stroke="${PALETTE.text}" stroke-width="3"/>`);

  const emphColor = (emphasis: string) => colorOf(toneStyle(tones, emphasis === 'accent' || emphasis === 'danger' ? emphasis : 'muted').ink, day);
  band.points.forEach((p, i) => {
    const color = p.emphasis ? emphColor(p.emphasis) : (i === 0 ? PALETTE[day].accent : PALETTE.muted);
    const r = p.emphasis === 'danger' ? 8 : i === 0 ? 6 : 5;
    if (p.dropLine) {
      parts.push(`<path d="M${Math.round(p.x)},${Math.round(p.y)} L${Math.round(p.x)},${Math.round(band.axisBottom)}" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="6,4"/>`);
    }
    parts.push(`<circle cx="${snap4(p.x)}" cy="${snap4(p.y)}" r="${r}" fill="${color}"/>`);
  });

  if (band.yTopLabel) parts.push(`<text x="${Math.round(band.axisX - 8)}" y="${Math.round(band.axisTop + 4)}" text-anchor="end" font-size="14" fill="${PALETTE.muted}">${escapeXml(band.yTopLabel)}</text>`);
  if (band.yBottomLabel) parts.push(`<text x="${Math.round(band.axisX - 8)}" y="${Math.round(band.axisBottom)}" text-anchor="end" font-size="14" fill="${PALETTE.muted}">${escapeXml(band.yBottomLabel)}</text>`);
  if (band.xLabel) parts.push(`<text x="${Math.round(band.axisX)}" y="${Math.round(band.axisBottom + 24)}" font-size="14" fill="${PALETTE.muted}">${escapeXml(band.xLabel)}</text>`);

  return parts.join('\n  ');
}

export const curveSpec = defineBand('curve', {
  childBands: (): Band[] => [],
  stackWidth: (): null => null,
  layout: layoutCurve,
  measure: (band, m) => { for (const label of [band.yTopLabel, band.yBottomLabel, band.xLabel]) if (label) m.atoms(label, m.roles.note, 400); },
  emit: {render: (b, day, tones) => renderCurve(b, day, tones)},
  fit: (): Iterable<number> => [],
  verify: {rects: band => [{id: null, label: labelOf(band), x: band.x, y: band.y, w: band.w, h: band.h}]},
  reveal: {stage: true},
});

/** New bands go here. */
export const REGISTERED_BAND_SPECS = [curveSpec] as const;

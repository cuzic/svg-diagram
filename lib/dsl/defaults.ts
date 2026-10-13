import type {Band, ConnectBand, ConnectDefaults, ConnectOpts} from '../types.ts';
import {mapBands, revealOf} from './shared.ts';

// The options a connector was written with, kept (non-enumerable) so diagram({connectDefaults}) can tell "not given" from "given as the default".
// Only connect() and branch() keep them: swimlane() flows are not connectors the user wrote, so the defaults do not touch them.
export const GIVEN = Symbol('connect-options');
export function applyConnectDefaults(bands: Band[], defaults: ConnectDefaults): Band[] {
  return mapBands(bands, b => {
    if (b.type !== 'connect') return undefined;
    const given = (b as ConnectBand & {[GIVEN]?: ConnectOpts})[GIVEN];
    if (!given) return undefined;
    const own = Object.fromEntries(Object.entries(given).filter(([, v]) => v !== undefined)) as ConnectOpts;
    const merged: ConnectOpts = {...defaults, ...own};
    if (own.marker !== undefined) merged.arrow = own.arrow; // the legacy spellings of arrow / line outrank the default
    if (own.dashed !== undefined) merged.line = own.line;
    if (!own.label) merged.chip = own.chip;                  // a chip needs a label
    const route = merged.route ?? 'straight';
    if (route !== 'elbow') { merged.bend = own.bend; merged.bendOffset = own.bendOffset; }
    if (route !== 'loop-under') merged.dip = own.dip;
    return connectBand(b.from, b.to, merged);
  });
}
export function connectBand(from: string, to: string, opts: ConnectOpts, trackGiven = true): ConnectBand {
  // arrow: 'end' (default) | 'both' | 'start' | 'none'  (legacy `marker: false` = 'none')
  // line:  'solid' (default) | 'dashed' | 'dotted' | 'double'  (legacy `dashed: true` = 'dashed')
  // weight: 'strong' = a thick line with its own arrowhead (not with 'double')
  // labelAt: 0..1 along a straight/loop-under connector where the label/chip sits (default 0.5)
  // chip:  true puts the label in a bordered pill sitting ON the line (protocol / rate tags)
  const arrow = opts.arrow ?? (opts.marker === false ? 'none' : 'end');
  const line = opts.line ?? (opts.dashed ? 'dashed' : 'solid');
  // weight: 'strong' = a thick line (a name for the meaning, not a px); 'double' already reads as a thick line, so the two cannot be combined
  if (opts.weight && line === 'double') throw new Error(`connect(${from} -> ${to}): weight '${opts.weight}' cannot go with line 'double' (both mean a thick line)`);
  const band: ConnectBand = {type: 'connect', from, to, route: opts.route ?? 'straight', dip: opts.dip ?? 32, bend: opts.bend ?? 0.5, bendOffset: opts.bendOffset, arrow, line, ...(opts.weight ? {weight: opts.weight} : {}), chip: !!opts.chip, labelAt: opts.labelAt ?? 0.5, tone: opts.tone, label: opts.label, ...revealOf(opts)};
  return trackGiven ? Object.defineProperty(band, GIVEN, {value: opts, configurable: true}) : band;
}

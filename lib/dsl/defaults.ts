import type {ConnectBand, ConnectOpts, ConnectVia} from '../types/containers.ts';
import type {ConnectDefaults} from '../types/core.ts';
import type {Band} from '../types/index.ts';
import {mapBands, revealOf} from './shared.ts';
import {sourceOf, withSource} from '../source-ref.ts';

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
    if (route !== 'loop-under' && route !== 'loop-side') merged.dip = own.dip;
    const band = withSource(connectBand(b.from, b.to, merged), sourceOf(b));
    return (b as ConnectBand).fan ? Object.assign(band, {fan: true as const}) : band;
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
  const via = opts.via === undefined ? undefined : checkVia(from, to, opts.via, opts.route ?? 'straight');
  const band: ConnectBand = {type: 'connect', from, to, route: opts.route ?? 'straight', dip: opts.dip ?? 32, bend: opts.bend ?? 0.5, bendOffset: opts.bendOffset, arrow, line, ...(opts.weight ? {weight: opts.weight} : {}), chip: !!opts.chip, labelAt: opts.labelAt ?? 0.5, tone: opts.tone, label: opts.label, ...revealOf(opts), ...(via ? {via} : {})};
  return trackGiven ? Object.defineProperty(band, GIVEN, {value: opts, configurable: true}) : band;
}

// connect({via}) (ADR 0069 D2): what can be told before layout. Whether an end sits in a framed group, and which way the other end lies, is
// checked when the connect is resolved (lib/layout-connect.ts).
function checkVia(from: string, to: string, via: unknown, route: string): ConnectVia {
  const who = `connect(${from} -> ${to})`;
  const ok = via === 'group' || (!!via && typeof via === 'object' && !Array.isArray(via) && Object.keys(via).length > 0
    && Object.entries(via).every(([k, v]) => (k === 'from' || k === 'to') && (v === 'group' || v === undefined)) && Object.values(via).includes('group'));
  if (!ok) throw new Error(`${who}: via is 'group', {from: 'group'} or {to: 'group'} (got ${JSON.stringify(via)})`);
  if (route !== 'straight' && route !== 'elbow') throw new Error(`${who}: via works with route 'straight' or 'elbow' (a ${route} runs round the boxes, not up to a frame)`);
  const v = via as ConnectVia;
  for (const [end, ref] of [['from', from], ['to', to]] as const) {
    if (v !== 'group' && v[end] !== 'group') continue;
    const side = (ref.split(':')[1] ?? '').split('@')[0];
    if (v !== 'group' && (!side || side === 'center')) throw new Error(`${who}: via ${end} needs a side on "${ref}" (left / right / top / bottom): the side says which edge of the frame the line stops on`);
  }
  return v;
}

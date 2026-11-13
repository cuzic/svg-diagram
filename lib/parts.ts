// The parts of a figure (ADR 0054, opt-in): `data-part="…"` on each element of a part (a class, a series, a legend entry), so the PowerPoint
// export can group the shapes of one part. Off by default: emitSvg({parts: true}) copies the bands with `parts: true` on them, and an
// emitter writes the attribute only on such a band, so no other drawing changes.
//
// The value is the part's path from outside in, one step per level, steps joined by `/`. A step is `kind:key|label`: the kind names what
// the part is (class, series, legend, ...), the key tells parts of one kind apart (a DSL id, or `#` and an index when there is none), and
// the label is what the part is called (its main text). `/`, `|` and `%` inside a step's fields are written as %2F, %7C and %25.
import {escapeAttr} from './emit-common.ts';
import type {LaidOutDiagram} from './types/index.ts';

export interface PartStep {kind: string; key: string; label: string}

const enc = (s: string): string => s.replace(/%/g, '%25').replace(/\//g, '%2F').replace(/\|/g, '%7C');
const dec = (s: string): string => s.replace(/%2F/g, '/').replace(/%7C/g, '|').replace(/%25/g, '%');

/** One step of a part's path. `key` is a DSL id, or an index (written `#3`) when the part has no id. */
export const partStep = (kind: string, key: string | number, label: string): string =>
  `${enc(kind)}:${typeof key === 'number' ? `#${key}` : enc(key)}|${enc(label)}`;

/** A plane's axes, their ticks and their names: one part (lib/plane.ts). */
export const PLANE_AXES = partStep('axes', 0, '');
/** A Gantt chart's date axis: its line, ticks and dates (lib/gantt.ts). */
export const GANTT_AXIS = partStep('axis', 0, '');

/** ` data-part="…"` when `on` (the band was drawn with parts), else nothing. */
export const partAttr = (on: boolean | undefined, ...steps: string[]): string => on && steps.length ? ` data-part="${escapeAttr(steps.join('/'))}"` : '';

/** `svg` (one or more drawn elements) with `attr` (from partAttr) on each drawn element: for a helper that draws a piece of a part. */
export const marked = (svg: string, attr: string): string => attr ? svg.replace(/<(rect|path|text|circle|ellipse|line|polygon|polyline)\b/g, `<$1${attr}`) : svg;

/** Whether a band is drawn with its parts marked. Any band may carry the flag, so this reads it without widening every band type. */
export const partsOn = (band: object): boolean => (band as {parts?: boolean}).parts === true;

/** A `data-part` value as its steps. */
export function parsePart(value: string): PartStep[] {
  return value.split('/').map(s => {
    const colon = s.indexOf(':'), bar = s.indexOf('|', colon + 1);
    return {kind: dec(s.slice(0, colon)), key: dec(s.slice(colon + 1, bar < 0 ? undefined : bar)), label: bar < 0 ? '' : dec(s.slice(bar + 1))};
  });
}

/** The laid-out diagram with every band marked to draw its parts. */
export const withParts = (d: LaidOutDiagram): LaidOutDiagram => ({...d, laidOut: d.laidOut.map(b => ({...b, parts: true}))});

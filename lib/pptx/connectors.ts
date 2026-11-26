import {textColorOf} from '../tokens.ts';
import {namedAs} from './prims.ts';
import {cxnXfrm, glueXml} from './connector-geometry-xml.ts';
import type {Glue} from './connector-geometry-xml.ts';
import type {ToneEnv} from '../tokens.ts';
import type {LaidOutDiagram} from '../types/index.ts';
import type {LaidOutConnect} from '../types/containers.ts';
import type {ConnXfrm} from './geom.ts';
import {emu, solidFill, arrowEnds, cxnSp} from './xml.ts';
import {unglued} from './free-line.ts';

export type {Glue} from './connector-geometry-xml.ts';

const widthPx = (c: LaidOutConnect): number => c.weight === 'strong' ? 5 : 2;
const lineWidth = (c: LaidOutConnect): number => emu(widthPx(c));

/** A `bentConnector` fitted to the routed points, glued at either end where the shape is a native one. */
export function connectorXml(id: number, c: LaidOutConnect, x: ConnXfrm, day: LaidOutDiagram['day'], tones: ToneEnv, start?: Glue, end?: Glue): string {
  const dash = c.line === 'dashed' ? '<a:prstDash val="dash"/>' : c.line === 'dotted' ? '<a:prstDash val="sysDot"/>' : '';
  const cmpd = c.line === 'double' ? ' cmpd="dbl"' : '';
  const av = x.adj.map((v, i) => `<a:gd name="adj${i + 1}" fmla="val ${v}"/>`).join('');
  return cxnSp(id, namedAs('arrow', c.label ?? '', `${c.fromId} → ${c.toId}`), glueXml(start, end), `${cxnXfrm(x, true)}<a:prstGeom prst="${x.prst}"><a:avLst>${av}</a:avLst></a:prstGeom><a:ln w="${lineWidth(c)}"${cmpd}>${solidFill(textColorOf(tones, c.tone, day))}${dash}${arrowEnds(c.arrow, widthPx(c))}</a:ln>`);
}

/** The fallback for a route no connector preset fits (and for annotations): a line, not glued (free-line.ts unglued decides its shape). */
export function freeformXml(id: number, c: LaidOutConnect, day: LaidOutDiagram['day'], tones: ToneEnv): string {
  const steps = c.points.map((p, i) => ({op: i ? 'L' as const : 'M' as const, pts: [p]}));
  return unglued(id, `freeform-${c.fromId}-${c.toId}`, steps, `<a:ln w="${lineWidth(c)}">${solidFill(textColorOf(tones, c.tone, day))}${arrowEnds(c.arrow, widthPx(c))}</a:ln>`);
}

import {PALETTE} from '../tokens.ts';
import {cxnXfrm, glueXml} from './connector-geometry-xml.ts';
import type {Glue} from './connector-geometry-xml.ts';
import type {ConnXfrm} from './geom.ts';
import {emu, solidFill, arrowEnds, cxnSp} from './xml.ts';

/** A straight arrow between two boxes of a `row` band, 2.5px as the svg draws it. */
export function rowArrowXml(id: number, name: string, x: ConnXfrm, start?: Glue, end?: Glue): string {
  return cxnSp(id, name, glueXml(start, end), `${cxnXfrm(x, false)}<a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom><a:ln w="${emu(2.5)}">${solidFill(PALETTE.text)}${arrowEnds('end', 2.5)}</a:ln>`);
}

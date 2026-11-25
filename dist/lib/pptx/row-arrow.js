import { PALETTE } from '../tokens.js';
import { cxnXfrm, glueXml } from './connector-geometry-xml.js';
import { emu, solidFill, arrowEnds, cxnSp } from './xml.js';
/** A straight arrow between two boxes of a `row` band, 2.5px as the svg draws it. */
export function rowArrowXml(id, name, x, start, end) {
    return cxnSp(id, name, glueXml(start, end), `${cxnXfrm(x, false)}<a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom><a:ln w="${emu(2.5)}">${solidFill(PALETTE.text)}${arrowEnds('end', 2.5)}</a:ln>`);
}

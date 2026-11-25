import type { Glue } from './connector-geometry-xml.ts';
import type { ConnXfrm } from './geom.ts';
/** A straight arrow between two boxes of a `row` band, 2.5px as the svg draws it. */
export declare function rowArrowXml(id: number, name: string, x: ConnXfrm, start?: Glue, end?: Glue): string;

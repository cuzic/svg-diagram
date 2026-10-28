import type { ToneEnv } from '../tokens.ts';
import type { LaidOutDiagram } from '../types/index.ts';
import type { LaidOutConnect } from '../types/containers.ts';
import type { ConnXfrm } from './geom.ts';
export interface Glue {
    id: number;
    idx: number;
}
/** A straight arrow between two boxes of a `row` band. */
export declare function rowArrowXml(id: number, name: string, x: ConnXfrm, start?: Glue, end?: Glue): string;
/** A `bentConnector` fitted to the routed points, glued at either end where the shape is a native one. */
export declare function connectorXml(id: number, c: LaidOutConnect, x: ConnXfrm, day: LaidOutDiagram['day'], tones: ToneEnv, start?: Glue, end?: Glue): string;
/** The fallback for a route no connector preset fits (and for annotations): a polyline, not glued. */
export declare function freeformXml(id: number, c: LaidOutConnect, day: LaidOutDiagram['day'], tones: ToneEnv): string;

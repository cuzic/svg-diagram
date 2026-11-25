import type { ConnXfrm } from './geom.ts';
export interface Glue {
    id: number;
    idx: number;
}
export declare function cxnXfrm(x: Omit<ConnXfrm, 'prst'>, withRot: boolean): string;
export declare const glueXml: (start?: Glue, end?: Glue) => string;

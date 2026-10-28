import { boxOf, type TextBoxFn } from './svg-geom.ts';
export interface RenderChecks {
    contrast: {
        txt: string;
        delta: number;
        fg: string;
        bg: string;
    }[];
    overflow: {
        dx: number;
        dy: number;
    } | null;
    textOverlap: {
        a: string;
        b: string;
        ratio: number;
    }[];
    containerOverflow: {
        txt: string;
        over: number;
    }[];
    covered: {
        txt: string;
        by: string;
        how: 'covers' | 'crosses';
    }[];
}
/** null when there is no <svg>; throws (with the reason) for XML it cannot read, and when a font file for the text boxes cannot be found. */
export declare function lintGeometry(src: string, measure: TextBoxFn): RenderChecks | null;
export { boxOf };

import type { PathStep } from './line-shapes.ts';
/** The steps of `d`, and whether it closes (Z) — a closed path is a shape that can be filled. */
export declare function svgPathSteps(d: string): {
    steps: PathStep[];
    closed: boolean;
};

import type { PlaneBand } from './types/figures.ts';
export declare const fmt: (n: number) => string;
export declare function ticksOf(axis: PlaneBand['x'], caller?: string): {
    at: number;
    label: string;
}[];

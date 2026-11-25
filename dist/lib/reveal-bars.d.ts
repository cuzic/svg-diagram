import type { RevealCtx } from './reveal-warnings.ts';
import type { BarsBand } from './types/bars.ts';
export declare function revealBars(b: BarsBand, n: number, u: number | undefined, ctx: Pick<RevealCtx, 'ownUntils' | 'replaced' | 'untils' | 'name' | 'set' | 'ids'>): void;
export declare function revealBarElements(data: BarsBand, start: number, end?: number): {
    last: number;
    warnings: never[];
    items: import("./types/bars.ts").BarDatum[];
};

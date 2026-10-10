import type { SlideBudget } from './types.ts';
export declare const BOTTOM_LIMIT = 520;
export declare function cacheKey(pageFile: string, heading: string, svg: string): string;
export declare function readSlideBudgetCache({ page, heading, svg, slidesMd }: {
    page: string;
    heading: string;
    svg: string;
    slidesMd?: string;
}): SlideBudget | null;
export declare function getSlideBudget({ page, heading, svg, slidesMd, refresh }: {
    page: string;
    heading: string;
    svg: string;
    slidesMd?: string;
    refresh?: boolean;
}): Promise<SlideBudget>;

export declare const MS_DAY = 86400000;
/** 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD' -> days since the epoch (UTC; a year or month means its first day). Never reads the clock. */
export declare function timelineDay(at: string, what: string): number;
/** Ticks on the axis: a step of whole months (1, 3, 6, 12, 24, 60) that leaves at most ~8 of them; each tick is a month that is a multiple of the step. */
export declare function ticksOf(from: number, to: number): {
    day: number;
    label: string;
}[];

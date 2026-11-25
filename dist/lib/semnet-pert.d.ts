import type { LaidOutChartPart, ChartGeom } from './charts-base.ts';
import type { PertAnalysis, PertTask } from './semnet-critical-path.ts';
import type { SemnetDirection, SemnetOpts } from './semnet-common.ts';
/** `durationLabel` / `slackLabel`: the words before a task's duration and slack (default 期間 / 余裕). */
export interface PertOpts extends SemnetOpts {
    unit?: string;
    compact?: boolean;
    durationLabel?: string;
    slackLabel?: string;
}
export interface PertSpec {
    tasks: PertTask[];
    analysis: PertAnalysis;
    direction: SemnetDirection;
    unit: string;
    compact: boolean;
    straighten: boolean;
    durationLabel: string;
    slackLabel: string;
}
export declare function resolvePert(tasks: readonly PertTask[], opts?: PertOpts): PertSpec;
export declare const pertAlt: (s: PertSpec) => string;
export declare function pertTexts(s: PertSpec): [string, number][];
export declare function layoutPert(s: PertSpec, g: ChartGeom): LaidOutChartPart;

import type { LaidOutConnect } from './types/containers.ts';
import type { SwimlaneBand } from './types/sequence-table-swimlane.ts';
import type { Finding } from './types/verdicts.ts';
export declare function swimlaneFindings(sl: SwimlaneBand, connects: readonly Pick<LaidOutConnect, 'fromId' | 'toId'>[]): Finding[];
export declare const swimlaneRules: Readonly<{
    readonly 'swimlane-lane-order': {
        readonly doc: 'レーンの並べ替えで、レーンをまたぐ距離を減らせる（swimlane の opts に laneOrder: \'auto\' を渡すと、この順に自動で並べる）';
        readonly scope: 'band';
    };
    readonly 'swimlane-lanes': {
        readonly doc: 'レーンが多い（6 本まで）';
        readonly scope: 'band';
    };
    readonly 'swimlane-hand-offs': {
        readonly doc: 'レーンをまたぐ引き継ぎの数（情報）';
        readonly scope: 'band';
    };
    readonly 'one-story': {
        readonly doc: '1 つの図に、スイムレーンが複数ある（1 図 1 話）';
        readonly scope: 'diagram';
    };
}>;

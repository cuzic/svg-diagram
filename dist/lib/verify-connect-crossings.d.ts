import type { LaidOutConnect } from './types/containers.ts';
import type { LaidOutDiagram } from './types/index.ts';
import type { Finding } from './types/verdicts.ts';
export declare const connectorRules: Readonly<{
    readonly 'edge-crossings': {
        readonly doc: '線どうしの交差・重なりがある';
        readonly scope: 'band-grouped';
    };
    readonly 'arrow-labels': {
        readonly doc: '一部にだけラベルがあり、ラベルのない矢印が多い';
        readonly scope: 'diagram';
    };
    readonly 'connect-label-covers-arrow': {
        readonly doc: "矢印のラベル(の下地)が、矢印の経路の 6 割より多くを覆い、見える部分が 20px に満たない。箱の間が狭く、矢じりや向きが読めなくなる。箱の間隔を広げる・ラベルを短くする・ラベルを箱の中に書く";
        readonly scope: 'band-grouped';
    };
    readonly 'graph-orphan-node': {
        readonly doc: '矢印でつないだ図の中に、どの矢印にもつながっていない箱がある（つなぎ忘れか、図に要らない箱。意図した注記なら id を付けない）';
        readonly scope: 'band-grouped';
    };
    readonly 'graph-disconnected': {
        readonly doc: '矢印でつないだ図が、互いにつながらない 2 つ以上のかたまりに分かれている（1 図 1 話なら、つなぎ忘れか、図を分ける）';
        readonly scope: 'band-grouped';
    };
}>;
export declare function edgeStats(connects: LaidOutConnect[]): {
    crossings: number;
    overlaps: number;
};
/** The connects (by index) that cross or overlap each other, for pointing at the pair rather than only counting. */
export declare function edgePairs(connects: LaidOutConnect[]): {
    crossings: [number, number][];
    overlaps: [number, number][];
};
export declare function connectorFindings(d: Partial<Pick<LaidOutDiagram, 'connects'>>): Finding[];

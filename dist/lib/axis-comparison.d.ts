import type { Band } from './types/index.ts';
import type { Finding } from './types/verdicts.ts';
export interface ValueAxis {
    label: string;
    unit: string; /** the value axis runs up the page (bars rise), else along it (bars run sideways) */
    vertical: boolean;
    min: number;
    max: number;
    own: boolean;
}
/**
 * The pairs whose axes are read against each other (ADR 0029 D5): (1) charts in different groups of one `grouprow` (side by side: a reader compares heights),
 * with the value axis up the page; (2) charts that follow one another in the same list with no other chart between them (one under the other: a reader
 * compares lengths), with the value axis along the page. Always the same unit, neither marked `axisGroup: false`.
 */
export declare function compareAxes(bands: readonly Band[], valueAxisOf: (band: Band) => ValueAxis | undefined, nestedBandsOf: (band: Band) => readonly Band[]): Map<string, Set<Band>>;
export declare function axisMismatchFindings(pairs: Map<string, Set<Band>>): Finding[];
export declare const axisRules: Readonly<{
    readonly 'chart-axis-mismatch': {
        readonly doc: "同じ単位で、横に並べる(同じ grouprow の別の group)か縦に続ける(間に別のチャートを挟まない)2 つのチャートの値の軸が違う。それぞれが自分のデータに合わせて軸を決めるので、同じ長さが別の値に見える(5.76 と 9.5 がほぼ同じ長さ)。両方に同じ domain: [0, 10] を書く(bars は max)。横向きのチャートは、ラベルの列の幅が違うと同じ値が別の長さに見えるので plotInset もそろえる。意図して別の量を別の軸で描くなら、axisGroup: false か accept";
        readonly scope: 'band-grouped';
    };
}>;

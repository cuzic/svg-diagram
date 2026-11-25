import type { FunnelBand } from './flow-shapes.ts';
import type { Finding } from './types/verdicts.ts';
export declare function funnelFindings(b: FunnelBand): Finding[];
export declare const funnelRules: Readonly<{
    readonly 'funnel-values-rise': {
        readonly doc: 'funnel({scale: "value"}) の値が下の段で増えている（漏斗として読むなら、値と段の順を確認する）';
        readonly scope: 'band';
    };
}>;
